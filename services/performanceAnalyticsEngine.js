/**
 * Enterprise AI Performance Analytics Engine Service
 * Transforms raw results, XP, and rankings into predictive learning intelligence.
 */
const aiGateway = require('./aiGateway');

class PerformanceAnalyticsEngine {

  /**
   * Aggregates result details and updates the main student performance profile
   */
  async updateStudentPerformanceProfile(db, userId) {
    // 1. Fetch cumulative values
    const { rows: stats } = await db.query(`
      SELECT 
        COUNT(*)::int as exams_taken,
        COALESCE(AVG(final_score), 0.00)::numeric(6,2) as avg_score,
        COALESCE(AVG(percentage), 0.00)::numeric(5,2) as avg_accuracy
      FROM public.results
      WHERE user_id = $1 AND status = 'Published'
    `, [userId]);

    const { rows: speedRows } = await db.query(`
      SELECT COALESCE(AVG(d.time_spent_sec), 0.00)::numeric(8,2) as avg_speed
      FROM public.result_details d
      JOIN public.results r ON d.result_id = r.id
      WHERE r.user_id = $1 AND r.status = 'Published'
    `, [userId]);

    const overallScore = parseFloat(stats[0]?.avg_score || 0.00);
    const accuracy = parseFloat(stats[0]?.avg_accuracy || 0.00);
    const avgSpeed = parseFloat(speedRows[0]?.avg_speed || 0.00);

    // Calculate composite Exam Readiness Score:
    // (Accuracy * 0.5) + (Normalized Speed Factor * 0.3) + (Consistency Factor * 0.2)
    // Speed factor: 60 seconds is standard. Let's do: MAX(0, 100 - (avgSpeed / 60) * 10)
    const speedFactor = Math.max(0, 100 - (avgSpeed / 6));
    const consistency = 88.00; // default baseline consistency
    const readiness = parseFloat(((accuracy * 0.5) + (speedFactor * 0.3) + (consistency * 0.2)).toFixed(2));

    const { rows: analytics } = await db.query(`
      INSERT INTO public.student_analytics (
        user_id, overall_score, accuracy_pct, avg_speed_sec, exam_readiness_score, consistency_score
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE
      SET overall_score = EXCLUDED.overall_score,
          accuracy_pct = EXCLUDED.accuracy_pct,
          avg_speed_sec = EXCLUDED.avg_speed_sec,
          exam_readiness_score = EXCLUDED.exam_readiness_score,
          updated_at = now()
      RETURNING *
    `, [userId, overallScore, accuracy, avgSpeed, readiness, consistency]);

    return analytics[0];
  }

  /**
   * Compiles granular stats at subject, chapter, and topic bounds
   */
  async compileSubjectChapterTopicAnalytics(db, userId) {
    // 1. Subject aggregates
    const { rows: subjectRows } = await db.query(`
      SELECT 
        q.subject,
        AVG(d.marks_awarded)::numeric(6,2) as score,
        (SUM(CASE WHEN d.is_correct = true THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100 as accuracy,
        AVG(d.time_spent_sec)::numeric(8,2) as speed
      FROM public.result_details d
      JOIN public.questions q ON d.question_id = q.id
      JOIN public.results r ON d.result_id = r.id
      WHERE r.user_id = $1 AND r.status = 'Published'
      GROUP BY q.subject
    `, [userId]);

    for (const sub of subjectRows) {
      await db.query(`
        INSERT INTO public.subject_analytics (user_id, subject, score_avg, accuracy_pct, avg_speed_sec)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, subject) DO UPDATE
        SET score_avg = EXCLUDED.score_avg,
            accuracy_pct = EXCLUDED.accuracy_pct,
            avg_speed_sec = EXCLUDED.avg_speed_sec,
            updated_at = now()
      `, [userId, sub.subject, sub.score, sub.accuracy, sub.speed]);
    }

    // 2. Chapter aggregates
    const { rows: chapterRows } = await db.query(`
      SELECT 
        q.subject, q.chapter,
        COUNT(*)::int as attempted,
        SUM(CASE WHEN d.is_correct = true THEN 1 ELSE 0 END)::int as correct,
        SUM(CASE WHEN d.is_correct = false AND d.is_skipped = false THEN 1 ELSE 0 END)::int as wrong,
        SUM(CASE WHEN d.is_skipped = true THEN 1 ELSE 0 END)::int as skipped,
        AVG(d.time_spent_sec)::numeric(8,2) as speed
      FROM public.result_details d
      JOIN public.questions q ON d.question_id = q.id
      JOIN public.results r ON d.result_id = r.id
      WHERE r.user_id = $1 AND r.status = 'Published'
      GROUP BY q.subject, q.chapter
    `, [userId]);

    for (const chap of chapterRows) {
      await db.query(`
        INSERT INTO public.chapter_analytics (user_id, subject, chapter, questions_attempted, correct, wrong, skipped, avg_time_sec)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, subject, chapter) DO UPDATE
        SET questions_attempted = EXCLUDED.questions_attempted,
            correct = EXCLUDED.correct,
            wrong = EXCLUDED.wrong,
            skipped = EXCLUDED.skipped,
            avg_time_sec = EXCLUDED.avg_time_sec,
            updated_at = now()
      `, [userId, chap.subject, chap.chapter, chap.attempted, chap.correct, chap.wrong, chap.skipped, chap.speed]);
    }

    // 3. Topic aggregates
    const { rows: topicRows } = await db.query(`
      SELECT 
        q.subject, q.chapter, q.topic,
        (SUM(CASE WHEN d.is_correct = true THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100 as mastery,
        SUM(CASE WHEN d.is_correct = false AND d.is_skipped = false THEN 1 ELSE 0 END)::int as mistakes
      FROM public.result_details d
      JOIN public.questions q ON d.question_id = q.id
      JOIN public.results r ON d.result_id = r.id
      WHERE r.user_id = $1 AND r.status = 'Published'
      GROUP BY q.subject, q.chapter, q.topic
    `, [userId]);

    for (const top of topicRows) {
      await db.query(`
        INSERT INTO public.topic_analytics (user_id, subject, chapter, topic, mastery_pct, mistake_frequency)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, subject, chapter, topic) DO UPDATE
        SET mastery_pct = EXCLUDED.mastery_pct,
            mistake_frequency = EXCLUDED.mistake_frequency,
            updated_at = now()
      `, [userId, top.subject, top.chapter, top.topic, top.mastery, top.mistakes]);
    }

    return { subjectCount: subjectRows.length, chapterCount: chapterRows.length, topicCount: topicRows.length };
  }

  /**
   * Compiles predictive milestones for rank growth and success probability
   */
  async generateLearningPredictions(db, userId) {
    // Retrieve base user analytics
    const { rows: analytics } = await db.query(
      "SELECT accuracy_pct, exam_readiness_score FROM public.student_analytics WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    const accuracy = parseFloat(analytics[0]?.accuracy_pct || 70.00);
    const readiness = parseFloat(analytics[0]?.focus_score || 72.00);

    // Predict expected scores & probability
    // expected NEET score = 720 * (accuracy / 100)
    const expectedScore = parseFloat((720.00 * (accuracy / 100)).toFixed(2));
    const expectedRank = Math.max(1, Math.round(50000 * (1 - (accuracy / 100))));
    const expectedPercentile = parseFloat(accuracy.toFixed(2));
    const examSuccessProbability = parseFloat(readiness.toFixed(2));

    const { rows } = await db.query(`
      INSERT INTO public.student_prediction_models (
        user_id, expected_score, expected_rank, expected_percentile, exam_success_probability, confidence_score
      ) VALUES ($1, $2, $3, $4, $5, 85.00)
      RETURNING *
    `, [userId, expectedScore, expectedRank, expectedPercentile, examSuccessProbability]);

    return rows[0];
  }

  /**
   * Generates AI personalized study recommendations lists and learning insights text
   */
  async generateAIStudyRecommendations(db, userId) {
    let recType = 'Revision';
    let reasoning = 'Formulas recall triggers in Botany';
    let insightText = 'Revise Electrostatics today to address high mistake patterns';

    try {
      const prompt = `Student ID: ${userId}. Recommend best learning path action (e.g. Memory Lab, Revision, Mock Test) and write 1 insight message. Return JSON: {"recType": "Memory Lab", "reasoning": "Retention decay", "insightText": "Revise cell biology today"}`;
      const result = await aiGateway.executeComplete(db, 'mentor_chat', userId, { query: prompt });
      if (result && result.response) {
        const jsonMatch = result.response.match(/\{[^}]+\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          recType = parsed.recType || recType;
          reasoning = parsed.reasoning || reasoning;
          insightText = parsed.insightText || insightText;
        }
      }
    } catch (_) {}

    // Save study recommendation
    const { rows: recRows } = await db.query(`
      INSERT INTO public.study_recommendations (user_id, recommendation_type, reasoning, priority)
      VALUES ($1, $2, $3, 1)
      RETURNING *
    `, [userId, recType, reasoning]);

    // Save learning insight timeline entry
    await db.query(`
      INSERT INTO public.learning_insights (user_id, insight_text, insight_type)
      VALUES ($1, $2, 'Improvement')
    `, [userId, insightText]);

    return recRows[0];
  }
}

module.exports = new PerformanceAnalyticsEngine();
