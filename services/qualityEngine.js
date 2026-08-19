const aiGateway = require('./aiGateway');

/**
 * Enterprise AI Question Quality Engine Core Service
 */
class QualityEngine {

  /**
   * Evaluates questions across 5 dimensions: Educational, Language, Options, Explanation, Difficulty
   */
  async evaluateDetailedQuestionQuality(db, userId, questionId) {
    const { rows: questions } = await db.query(
      "SELECT question_text, explanation FROM public.questions WHERE id = $1",
      [questionId]
    );
    if (questions.length === 0) throw new Error("Question not found.");

    const q = questions[0];
    const prompt = `Evaluate quality scores (0-100) for NEET question text: "${q.question_text}" and explanation: "${q.explanation}". Provide JSON: {"educational": 90, "language": 95, "option": 85, "explanation": 80, "difficulty": 90}`;

    let scores = {
      educational: 90.0,
      language: 95.0,
      option: 85.0,
      explanation: 80.0,
      difficulty: 90.0
    };

    try {
      const result = await aiGateway.executeComplete(db, 'mentor_chat', userId, {
        query: prompt
      });
      if (result && result.response) {
        const jsonMatch = result.response.match(/{[^}]+}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          scores.educational = parsed.educational || scores.educational;
          scores.language = parsed.language || scores.language;
          scores.option = parsed.option || scores.option;
          scores.explanation = parsed.explanation || scores.explanation;
          scores.difficulty = parsed.difficulty || scores.difficulty;
        }
      }
    } catch (err) {
      console.warn("[QualityEngine] AI Gateway connection failed, using default quality matrices:", err.message);
    }

    const overall = parseFloat((
      (scores.educational * 0.3) +
      (scores.language * 0.1) +
      (scores.option * 0.15) +
      (scores.explanation * 0.15) +
      (scores.difficulty * 0.1)
    ).toFixed(2));

    const { rows: newQuality } = await db.query(`
      INSERT INTO public.question_quality (
        question_id, educational_quality_score, language_quality_score, option_quality_score, explanation_quality_score, difficulty_accuracy_score, overall_quality_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      questionId,
      scores.educational,
      scores.language,
      scores.option,
      scores.explanation,
      scores.difficulty,
      overall
    ]);

    // Save to quality history log
    await db.query(`
      INSERT INTO public.quality_history (question_id, updated_by, previous_score, new_score, trigger_event)
      VALUES ($1, $2, NULL, $3, 'AIReview')
    `, [questionId, userId, overall]);

    return newQuality[0];
  }

  /**
   * Recalculates dynamic health index out of 100
   */
  async evaluateQuestionHealth(db, questionId) {
    const { rows: qualityRows } = await db.query(
      "SELECT overall_quality_score FROM public.question_quality WHERE question_id = $1 ORDER BY created_at DESC LIMIT 1",
      [questionId]
    );

    const qScore = qualityRows[0]?.overall_quality_score || 85.0;

    // Check attempts metrics (correct %, wrong %, skips)
    const { rows: metrics } = await db.query(
      "SELECT COALESCE(correct_pct, 70.0) as correct, COALESCE(skip_pct, 5.0) as skip FROM public.quality_metrics WHERE question_id = $1",
      [questionId]
    );

    const m = metrics[0] || { correct: 70.0, skip: 5.0 };
    const skipImpact = (m.skip > 15.0) ? 10.0 : 0.0;

    const health = parseFloat((qScore - skipImpact).toFixed(2));

    const { rows: healthRow } = await db.query(`
      INSERT INTO public.question_health (question_id, health_score, completeness_ratio)
      VALUES ($1, $2, 100.0)
      RETURNING *
    `, [questionId, health]);

    return healthRow[0];
  }

  /**
   * Compares syllabus difficulty configurations against actual student metrics
   */
  async analyzeDifficultyDrift(db, questionId) {
    const { rows: q } = await db.query(
      "SELECT difficulty FROM public.questions WHERE id = $1",
      [questionId]
    );
    if (q.length === 0) throw new Error("Question not found.");

    const orig = q[0].difficulty || 'Medium';

    // Retrieve metrics
    const { rows: metrics } = await db.query(
      "SELECT correct_pct FROM public.quality_metrics WHERE question_id = $1",
      [questionId]
    );

    const correct = metrics[0]?.correct_pct || 70.0;
    let liveDiff = 'Medium';
    if (correct > 80.0) liveDiff = 'Easy';
    else if (correct < 40.0) liveDiff = 'Hard';

    const drift = orig !== liveDiff;

    const { rows: driftRow } = await db.query(`
      INSERT INTO public.difficulty_drift (question_id, original_difficulty, estimated_difficulty, live_difficulty, drift_detected_flag)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [questionId, orig, orig, liveDiff, drift]);

    if (drift) {
      await db.query(`
        INSERT INTO public.quality_reviews (question_id, priority_level, trigger_reason)
        VALUES ($1, 'High', $2)
      `, [questionId, `Difficulty Drift: Original is ${orig} but Live performance indicates ${liveDiff}`]);
    }

    return driftRow[0];
  }

  /**
   * Generates quality improvements and recommendations
   */
  async generateQualityImprovementPlan(db, questionId) {
    const { rows: quality } = await db.query(
      "SELECT overall_quality_score FROM public.question_quality WHERE question_id = $1 ORDER BY created_at DESC LIMIT 1",
      [questionId]
    );

    const score = quality[0]?.overall_quality_score || 85.0;
    let action = "Content quality meets FUTRIX Enterprise Grade criteria.";

    if (score < 80.0) {
      action = "Improve explanation detail and add mnemonic formula tips.";
      await db.query(`
        INSERT INTO public.content_improvements (question_id, improvement_type, description)
        VALUES ($1, 'Explanation Detailing', $2)
      `, [questionId, action]);
    }

    const { rows } = await db.query(`
      INSERT INTO public.quality_recommendations (question_id, recommendation_type, recommended_action, priority_score)
      VALUES ($1, 'Quality Tuning', $2, $3)
      RETURNING *
    `, [questionId, action, score]);

    return rows[0];
  }

  /**
   * Aggregates quality dashboard metrics
   */
  async getQualityDashboard(db) {
    const { rows: avgQuality } = await db.query(
      "SELECT COALESCE(AVG(overall_quality_score), 90.0)::numeric(5,2) as score FROM public.question_quality"
    );
    const { rows: lowQuality } = await db.query(
      "SELECT count(*)::int as count FROM public.question_quality WHERE overall_quality_score < 70.0"
    );

    return {
      averageQualityScore: parseFloat(avgQuality[0].score),
      lowQualityQuestionsCount: lowQuality[0].count,
      activeScoringModel: 'gemini-2.5-pro'
    };
  }
}

module.exports = new QualityEngine();
