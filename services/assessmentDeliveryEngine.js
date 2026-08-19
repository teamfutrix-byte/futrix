/**
 * Enterprise Assessment Delivery Engine (ADE) Service
 * Secure exam runtime execution, auto-saves checkpoints, and anti-cheat tracking.
 */
const crypto = require('crypto');

class AssessmentDeliveryEngine {

  /**
   * Initializes a secure exam session with signature tokens
   */
  async startExamSession(db, userId, testId, deviceData) {
    // 1. Verify Attempt Eligibility
    const { rows: testRows } = await db.query(
      "SELECT status, duration_minutes FROM public.tests WHERE id = $1",
      [testId]
    );

    if (testRows.length === 0) throw new Error("Target assessment not found.");
    if (testRows[0].status === 'Draft' || testRows[0].status === 'Archived') {
      throw new Error(`Assessment is currently unavailable: status is ${testRows[0].status}`);
    }

    const { rows: attemptCheck } = await db.query(
      "SELECT count(*)::int as count FROM public.assessment_attempts WHERE user_id = $1 AND test_id = $2 AND status = 'Completed'",
      [userId, testId]
    );

    if (attemptCheck[0].count >= 3) {
      throw new Error("Test attempt limit exceeded (Max 3 attempts permitted).");
    }

    // 2. Generate secure tokens
    const sessionIdStr = `sess_${crypto.randomBytes(8).toString('hex')}`;
    const attemptToken = crypto.createHmac('sha256', 'futrix-exam-secret')
      .update(`${userId}:${testId}:${Date.now()}`)
      .digest('hex');

    const deviceFingerprint = deviceData?.deviceFingerprint || 'Unknown Device';
    const browserFingerprint = deviceData?.browserFingerprint || 'Unknown Browser';
    const ipHash = crypto.createHash('sha256').update(deviceData?.ip || '127.0.0.1').digest('hex');
    const signature = crypto.createHmac('sha256', 'futrix-session-sig')
      .update(`${sessionIdStr}:${userId}:${attemptToken}`)
      .digest('hex');

    // 3. Register Session
    const { rows: sessionRows } = await db.query(`
      INSERT INTO public.assessment_sessions (
        user_id, test_id, session_id, encrypted_attempt_token,
        device_fingerprint, browser_fingerprint, ip_hash, session_signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [userId, testId, sessionIdStr, attemptToken, deviceFingerprint, browserFingerprint, ipHash, signature]);

    const session = sessionRows[0];

    // 4. Create Attempt Record
    await db.query(`
      INSERT INTO public.assessment_attempts (session_id, user_id, test_id, status)
      VALUES ($1, $2, $3, 'In Progress')
    `, [session.id, userId, testId]);

    // 5. Initialize Resume Checkpoint
    await db.query(`
      INSERT INTO public.resume_checkpoints (assessment_session_id, checkpoint_json)
      VALUES ($1, $2)
    `, [session.id, JSON.stringify({ answersSaved: 0, lastCheckAt: new Date().toISOString() })]);

    // 6. Record Delivery Analytics increment
    await db.query(`
      INSERT INTO public.delivery_analytics (test_id, total_started)
      VALUES ($1, 1)
      ON CONFLICT (test_id) DO UPDATE
      SET total_started = public.delivery_analytics.total_started + 1
    `, [testId]).catch(() => {});

    return { session, attemptToken };
  }

  /**
   * Auto-saves user answer choices and updates checkpoints
   */
  async saveAnswerSnapshot(db, sessionId, questionId, selectedOption, timeSpentSec, markedForReview) {
    // 1. Save or update answer snapshot
    const { rows: snapshotRows } = await db.query(`
      INSERT INTO public.answer_snapshots (assessment_session_id, question_id, selected_option, time_spent_sec, marked_for_review)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (assessment_session_id, question_id) DO UPDATE
      SET selected_option = $3, time_spent_sec = public.answer_snapshots.time_spent_sec + $4,
          marked_for_review = $5, updated_at = now()
      RETURNING *
    `, [sessionId, questionId, selectedOption || null, timeSpentSec || 0, markedForReview || false]);

    // 2. Fetch all saved answers to serialize in checkpoint
    const { rows: allSaved } = await db.query(
      "SELECT question_id, selected_option, marked_for_review FROM public.answer_snapshots WHERE assessment_session_id = $1",
      [sessionId]
    );

    // 3. Update resume checkpoint JSON
    await db.query(`
      INSERT INTO public.resume_checkpoints (assessment_session_id, checkpoint_json)
      VALUES ($1, $2)
      ON CONFLICT (assessment_session_id) DO UPDATE
      SET checkpoint_json = $2, updated_at = now()
    `, [sessionId, JSON.stringify({ answers: allSaved, lastCheckAt: new Date().toISOString() })]);

    return snapshotRows[0];
  }

  /**
   * Resumes session checkpoint details
   */
  async resumeSession(db, sessionId, userId) {
    // 1. Verify session active status
    const { rows: sessionRows } = await db.query(
      "SELECT id, status, test_id FROM public.assessment_sessions WHERE session_id = $1 AND user_id = $2 LIMIT 1",
      [sessionId, userId]
    );

    if (sessionRows.length === 0) throw new Error("Assessment session not found.");
    const sess = sessionRows[0];

    if (sess.status === 'Submitted') throw new Error("This assessment session has already been submitted.");

    // 2. Pull Checkpoint JSON data
    const { rows: checkpointRows } = await db.query(
      "SELECT checkpoint_json FROM public.resume_checkpoints WHERE assessment_session_id = $1 LIMIT 1",
      [sess.id]
    );

    const checkpoint = checkpointRows[0]?.checkpoint_json || {};

    // 3. Log auto-resume event
    await db.query(`
      INSERT INTO public.runtime_events (assessment_session_id, event_type, payload_json)
      VALUES ($1, 'AutoResumeCheck', $2)
    `, [sess.id, JSON.stringify({ checkpointTime: new Date().toISOString() })]);

    return { sessionId, testId: sess.test_id, checkpoint };
  }

  /**
   * Monitors and registers anti-cheat events and adjusts risk scores
   */
  async logAntiCheatEvent(db, sessionId, ruleName, evidence, severity) {
    // 1. Log to anti_cheat_logs
    const { rows: logRows } = await db.query(`
      INSERT INTO public.anti_cheat_logs (assessment_session_id, rule_name, evidence, severity)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [sessionId, ruleName, evidence || 'Forbidden activity detected', severity || 'Medium']);

    // 2. Calculate risk weight
    let weight = 10;
    if (severity === 'High') weight = 30;
    else if (severity === 'Critical') weight = 55;

    // 3. Upsert Risk Score
    const { rows: scoreRows } = await db.query(`
      INSERT INTO public.risk_scores (assessment_session_id, risk_score, risk_level, evidence_summary)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (assessment_session_id) DO UPDATE
      SET risk_score = LEAST(100, public.risk_scores.risk_score + $2),
          updated_at = now()
      RETURNING *
    `, [sessionId, weight, severity, `Triggered rule ${ruleName}`]);

    // Recalculate Risk Level based on cumulative score
    const currentScore = scoreRows[0].risk_score;
    let newLevel = 'Low';
    if (currentScore > 75) newLevel = 'Critical';
    else if (currentScore > 50) newLevel = 'High';
    else if (currentScore > 25) newLevel = 'Medium';

    await db.query(
      "UPDATE public.risk_scores SET risk_level = $2 WHERE assessment_session_id = $1",
      [sessionId, newLevel]
    );

    // Increment alerts count in analytics
    const { rows: sess } = await db.query("SELECT test_id FROM public.assessment_sessions WHERE id = $1", [sessionId]);
    if (sess.length > 0) {
      await db.query(`
        UPDATE public.delivery_analytics
        SET cheat_alerts_triggered = cheat_alerts_triggered + 1
        WHERE test_id = $1
      `, [sess[0].test_id]).catch(() => {});
    }

    return { logEntry: logRows[0], currentRiskScore: currentScore, riskLevel: newLevel };
  }

  /**
   * Seals attempts and triggers final submissions queue
   */
  async submitAssessment(db, sessionId) {
    // 1. Verify session active
    const { rows: sessionRows } = await db.query(
      "SELECT id, user_id, test_id, status FROM public.assessment_sessions WHERE session_id = $1 OR id::text = $1 LIMIT 1",
      [sessionId]
    );

    if (sessionRows.length === 0) throw new Error("Assessment session not found.");
    const sess = sessionRows[0];

    if (sess.status === 'Submitted') throw new Error("Assessment has already been submitted.");

    // 2. Transition Session Status
    await db.query(`
      UPDATE public.assessment_sessions
      SET status = 'Submitted', updated_at = now()
      WHERE id = $1
    `, [sess.id]);

    // 3. Complete Attempt Record
    await db.query(`
      UPDATE public.assessment_attempts
      SET status = 'Completed', completed_at = now()
      WHERE session_id = $1
    `, [sess.id]);

    // 4. Update Delivery Analytics
    await db.query(`
      UPDATE public.delivery_analytics
      SET total_submitted = total_submitted + 1
      WHERE test_id = $1
    `, [sess.test_id]).catch(() => {});

    // 5. Compile receipt snapshot details
    const { rows: answersCount } = await db.query(
      "SELECT count(*)::int as count FROM public.answer_snapshots WHERE assessment_session_id = $1",
      [sess.id]
    );

    const submissionReceipt = crypto.createHmac('sha256', 'futrix-receipt')
      .update(`${sess.id}:${answersCount[0].count}:${Date.now()}`)
      .digest('hex');

    return {
      success: true,
      message: 'Assessment submitted successfully.',
      answersSaved: answersCount[0].count,
      submissionReceipt
    };
  }

  /**
   * Real-time monitoring metrics compilation
   */
  async getLiveExamMonitoring(db) {
    const { rows: liveSessions } = await db.query(
      "SELECT count(*)::int as count FROM public.assessment_sessions WHERE status = 'Active'"
    );

    const { rows: suspiciousCount } = await db.query(`
      SELECT count(distinct r.assessment_session_id)::int as count
      FROM public.risk_scores r
      WHERE r.risk_score > 50
    `);

    const { rows: autoResumeCount } = await db.query(`
      SELECT count(*)::int as count
      FROM public.runtime_events
      WHERE event_type = 'AutoResumeCheck'
    `);

    return {
      activeStudentsCount: liveSessions[0].count,
      suspiciousSessionsCount: suspiciousCount[0].count,
      autoResumeEventsCount: autoResumeCount[0].count,
      serverLoadPercentage: 24.50, // mock Telemetry
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AssessmentDeliveryEngine();
