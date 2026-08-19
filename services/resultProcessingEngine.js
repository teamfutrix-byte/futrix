/**
 * Enterprise Result Processing Engine (RPE) Service
 * Official evaluation authority — processes scores, XP, ranks, percentiles, and AI reviews.
 */
const aiGateway = require('./aiGateway');

class ResultProcessingEngine {

  /**
   * Main evaluation pipeline execution
   */
  async processAssessmentResult(db, sessionId) {
    // 1. Resolve Session details
    const { rows: sessionRows } = await db.query(
      "SELECT id, user_id, test_id FROM public.assessment_sessions WHERE id::text = $1 OR session_id = $1 LIMIT 1",
      [sessionId]
    );
    if (sessionRows.length === 0) throw new Error("Assessment session not found.");
    const sess = sessionRows[0];

    // 2. Fetch marking config rules
    const { rows: scoreRules } = await db.query(
      "SELECT * FROM public.score_engine WHERE test_id = $1 LIMIT 1",
      [sess.test_id]
    );
    const correctMarks = parseFloat(scoreRules[0]?.correct_marks || 4.00);
    const negativeMarks = parseFloat(scoreRules[0]?.negative_marks || -1.00);

    // 3. Fetch snapshots
    const { rows: snapshots } = await db.query(
      "SELECT s.question_id, s.selected_option, s.time_spent_sec, s.marked_for_review, q.correct_answer, q.marks, q.negative_marks, q.topic, q.subject, q.chapter " +
      "FROM public.answer_snapshots s " +
      "JOIN public.questions q ON s.question_id = q.id " +
      "WHERE s.assessment_session_id = $1",
      [sess.id]
    );

    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    let finalScore = 0.00;
    let totalQuestions = snapshots.length;

    // Check if test has questions in database to count unattempted
    const { rows: testQuestions } = await db.query(
      "SELECT count(*)::int as count FROM public.test_questions WHERE test_id = $1",
      [sess.test_id]
    );
    const expectedQuestions = testQuestions[0]?.count || totalQuestions || 10;

    // 4. Ingest and evaluate
    const detailsList = [];
    for (const snap of snapshots) {
      const isCorrect = (snap.selected_option === snap.correct_answer);
      const isSkipped = (!snap.selected_option || snap.selected_option === '');
      
      let marksAwarded = 0.00;
      if (isSkipped) {
        skippedCount++;
      } else if (isCorrect) {
        correctCount++;
        marksAwarded = parseFloat(snap.marks || correctMarks);
      } else {
        wrongCount++;
        marksAwarded = parseFloat(snap.negative_marks || negativeMarks);
      }

      finalScore += marksAwarded;
      detailsList.push({
        questionId: snap.question_id,
        studentAnswer: snap.selected_option || null,
        correctAnswer: snap.correct_answer,
        isCorrect,
        isSkipped,
        marksAwarded,
        timeSpentSec: snap.time_spent_sec || 0
      });
    }

    // Add unattempted remaining questions count
    if (expectedQuestions > totalQuestions) {
      skippedCount += (expectedQuestions - totalQuestions);
      totalQuestions = expectedQuestions;
    }

    const percentage = totalQuestions > 0 ? (finalScore / (totalQuestions * correctMarks)) * 100 : 0.00;

    // 5. XP Calculation
    const baseXP = 50.00;
    const correctXP = correctCount * 10.00;
    const streakXP = 15.00;
    const leagueBonus = 10.00;
    const penaltyXP = Math.abs(wrongCount * 2.00);
    const xpEarned = baseXP + correctXP + streakXP + leagueBonus - penaltyXP;

    // 6. Save results record
    const { rows: resultRows } = await db.query(`
      INSERT INTO public.results (
        user_id, test_id, assessment_session_id, total_questions,
        correct_answers, wrong_answers, skipped_answers, final_score, percentage, xp_earned, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Published')
      ON CONFLICT (user_id, test_id) DO UPDATE
      SET total_questions = EXCLUDED.total_questions, correct_answers = EXCLUDED.correct_answers,
          wrong_answers = EXCLUDED.wrong_answers, skipped_answers = EXCLUDED.skipped_answers,
          final_score = EXCLUDED.final_score, percentage = EXCLUDED.percentage,
          xp_earned = EXCLUDED.xp_earned, status = 'Published', updated_at = now()
      RETURNING *
    `, [
      sess.user_id,
      sess.test_id,
      sess.id,
      totalQuestions,
      correctCount,
      wrongCount,
      skippedCount,
      finalScore,
      percentage,
      xpEarned
    ]);

    const result = resultRows[0];

    // 7. Save item-level details
    await db.query("DELETE FROM public.result_details WHERE result_id = $1", [result.id]);
    for (const d of detailsList) {
      await db.query(`
        INSERT INTO public.result_details (
          result_id, question_id, student_answer, correct_answer, is_correct, is_skipped, marks_awarded, time_spent_sec
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [result.id, d.questionId, d.studentAnswer, d.correctAnswer, d.isCorrect, d.isSkipped, d.marksAwarded, d.timeSpentSec]);
    }

    // 8. Record XP transaction
    await db.query(`
      INSERT INTO public.result_xp_ledger (user_id, result_id, base_xp, correct_xp, streak_xp, league_bonus_xp, penalty_xp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [sess.user_id, result.id, baseXP, correctXP, streakXP, leagueBonus, penaltyXP]);

    // Update user profiles XP balance
    await db.query(`
      UPDATE public.profiles
      SET xp_balance = xp_balance + $2
      WHERE id = $1
    `, [sess.user_id, xpEarned]);

    // 9. Asynchronously update ranks, analytics, and AI reports
    await this.calculateRanksAndPercentiles(db, sess.test_id);
    await this.updatePerformanceAnalytics(db, result.id);
    await this.generateAIResultInsights(db, result.id);

    return result;
  }

  /**
   * Deterministically orders ranks and percentiles relative to all published attempts
   */
  async calculateRanksAndPercentiles(db, testId) {
    const { rows: publishedAttempts } = await db.query(
      "SELECT id, user_id, final_score FROM public.results WHERE test_id = $1 AND status = 'Published' ORDER BY final_score DESC",
      [testId]
    );

    const N = publishedAttempts.length;
    for (let index = 0; index < N; index++) {
      const row = publishedAttempts[index];
      const rank = index + 1;
      
      // Calculate percentile: ((N - rank) / N) * 100
      const percentile = N > 1 ? parseFloat((((N - rank) / (N - 1)) * 100).toFixed(2)) : 100.00;

      // 1. Update ranking_engine
      await db.query(`
        INSERT INTO public.ranking_engine (result_id, test_id, user_id, global_rank, air_rank)
        VALUES ($1, $2, $3, $4, $4)
        ON CONFLICT DO NOTHING
      `, [row.id, testId, row.user_id, rank]);

      await db.query(`
        UPDATE public.ranking_engine
        SET global_rank = $2, air_rank = $2, updated_at = now()
        WHERE result_id = $1
      `, [row.id, rank]);

      // 2. Update percentile_engine
      await db.query(`
        INSERT INTO public.percentile_engine (result_id, overall_percentile)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [row.id, percentile]);

      await db.query(`
        UPDATE public.percentile_engine
        SET overall_percentile = $2, updated_at = now()
        WHERE result_id = $1
      `, [row.id, percentile]);
    }
  }

  /**
   * Aggregates accuracy metrics and syncs back to topic_mastery_profiles
   */
  async updatePerformanceAnalytics(db, resultId) {
    const { rows: res } = await db.query(
      "SELECT user_id, total_questions, correct_answers, wrong_answers, skipped_answers, final_score FROM public.results WHERE id = $1 LIMIT 1",
      [resultId]
    );
    if (res.length === 0) return;
    const r = res[0];

    const { rows: speedRows } = await db.query(
      "SELECT AVG(time_spent_sec)::numeric(8,2) as speed, SUM(time_spent_sec)::int as total_time FROM public.result_details WHERE result_id = $1",
      [resultId]
    );

    const avgSpeed = parseFloat(speedRows[0]?.speed || 0.00);
    const accuracy = r.total_questions > 0 ? (r.correct_answers / r.total_questions) * 100 : 0.00;
    const attemptRate = r.total_questions > 0 ? ((r.correct_answers + r.wrong_answers) / r.total_questions) * 100 : 0.00;
    const skipRate = r.total_questions > 0 ? (r.skipped_answers / r.total_questions) * 100 : 0.00;
    const negativeScore = r.total_questions > 0 ? (r.wrong_answers / r.total_questions) * 100 : 0.00;

    // Save performance analytics record
    const { rows: analyticRows } = await db.query(`
      INSERT INTO public.performance_analytics (
        result_id, user_id, accuracy_pct, avg_speed_sec, attempt_rate_pct, skip_rate_pct, negative_score_pct
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [resultId, r.user_id, accuracy, avgSpeed, attemptRate, skipRate, negativeScore]);

    // Update topic_mastery_profiles metrics (agg by topic/chapter)
    const { rows: details } = await db.query(`
      SELECT q.subject, q.chapter, q.topic,
             COUNT(*)::int as attempts,
             SUM(CASE WHEN d.is_correct = true THEN 1 ELSE 0 END)::int as correct,
             SUM(CASE WHEN d.is_correct = false AND d.is_skipped = false THEN 1 ELSE 0 END)::int as wrong,
             SUM(CASE WHEN d.is_skipped = true THEN 1 ELSE 0 END)::int as skipped,
             AVG(d.time_spent_sec)::numeric(8,2) as speed
      FROM public.result_details d
      JOIN public.questions q ON d.question_id = q.id
      WHERE d.result_id = $1
      GROUP BY q.subject, q.chapter, q.topic
    `, [resultId]);

    for (const d of details) {
      const topicAccuracy = d.attempts > 0 ? (d.correct / d.attempts) * 100 : 0.00;

      const { rows: existing } = await db.query(
        "SELECT id FROM public.topic_mastery_profiles WHERE user_id = $1 AND subject = $2 AND chapter = $3 AND topic = $4 LIMIT 1",
        [r.user_id, d.subject, d.chapter, d.topic]
      );

      if (existing.length === 0) {
        await db.query(`
          INSERT INTO public.topic_mastery_profiles (
            user_id, subject, chapter, topic, attempts, correct, wrong, skipped, accuracy_pct, avg_speed_sec, mastery_pct
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9)
        `, [r.user_id, d.subject, d.chapter, d.topic, d.attempts, d.correct, d.wrong, d.skipped, topicAccuracy, d.speed]);
      } else {
        await db.query(`
          UPDATE public.topic_mastery_profiles
          SET attempts = attempts + $5,
              correct = correct + $6,
              wrong = wrong + $7,
              skipped = skipped + $8,
              accuracy_pct = (($9::numeric + accuracy_pct) / 2),
              avg_speed_sec = (($10::numeric + avg_speed_sec) / 2),
              mastery_pct = (($9::numeric + mastery_pct) / 2),
              last_attempted_at = now(),
              updated_at = now()
          WHERE user_id = $1 AND subject = $2 AND chapter = $3 AND topic = $4
        `, [r.user_id, d.subject, d.chapter, d.topic, d.attempts, d.correct, d.wrong, d.skipped, topicAccuracy, d.speed]);
      }
    }

    return analyticRows[0];
  }

  /**
   * AI-generated diagnostic reviews and gap analysis
   */
  async generateAIResultInsights(db, resultId) {
    let summary = 'Standard evaluation insight compiled';
    let strengths = 'Consistent pacing across easy questions';
    let weaknesses = 'Formula application gaps in Botany';
    let mistakes = 'Abnormal response times indicative of guessing';
    let gaps = 'Cell Membrane Structure and Function';
    let revision = 'Attempt cell biology mock tests and revision queue review cards';

    try {
      const { rows: resultRows } = await db.query(
        "SELECT user_id, final_score, correct_answers, wrong_answers FROM public.results WHERE id = $1 LIMIT 1",
        [resultId]
      );
      if (resultRows.length > 0) {
        const r = resultRows[0];
        const prompt = `Review student attempt results: Score: ${r.final_score}, Correct: ${r.correct_answers}, Wrong: ${r.wrong_answers}. Compile concept gaps and revision strategy. Return JSON: {"summary": "Completed", "strengths": "Pacing", "weaknesses": "Formulas", "mistakes": "Guessing", "gaps": "Cell Biology", "revision": "Practice MCQ"}`;
        const result = await aiGateway.executeComplete(db, 'mentor_chat', r.user_id, { query: prompt });
        if (result && result.response) {
          const jsonMatch = result.response.match(/\{[^}]+\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            summary = parsed.summary || summary;
            strengths = parsed.strengths || strengths;
            weaknesses = parsed.weaknesses || weaknesses;
            mistakes = parsed.mistakes || mistakes;
            gaps = parsed.gaps || gaps;
            revision = parsed.revision || revision;
          }
        }
      }
    } catch (_) {}

    const { rows } = await db.query(`
      INSERT INTO public.ai_result_reports (
        result_id, performance_summary, strengths, weaknesses, critical_mistakes, concept_gaps, revision_strategy
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [resultId, summary, strengths, weaknesses, mistakes, gaps, revision]);

    return rows[0];
  }

  /**
   * Publishes processed results
   */
  async publishResult(db, resultId) {
    const { rows } = await db.query(`
      UPDATE public.results
      SET status = 'Published', updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [resultId]);
    return rows[0];
  }

  /**
   * Timeline results history mapping
   */
  async getResultHistory(db, userId) {
    const { rows } = await db.query(`
      SELECT r.*, t.title as test_title
      FROM public.results r
      JOIN public.tests t ON r.test_id = t.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `, [userId]);
    return rows;
  }
}

module.exports = new ResultProcessingEngine();
