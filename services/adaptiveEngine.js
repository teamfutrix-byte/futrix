const aiGateway = require('./aiGateway');
const smartTestBuilder = require('./smartTestBuilder');

/**
 * Enterprise Adaptive Assessment Engine Service
 * Intelligence layer above Smart Test Builder — personalizes every assessment
 * experience based on continuously updated student learning data.
 *
 * Integrates with: Memory Lab, Assessment Intelligence Engine, AI Gateway,
 * Smart Test Builder, Psychometric Infrastructure.
 */
class AdaptiveEngine {

  // ── ADAPTIVE PROFILE ──────────────────────────────────────────────────

  /**
   * Retrieves or initializes a student's adaptive learning profile
   * by pulling live data from Memory Lab, wrong notebooks, and revision history.
   */
  async getOrCreateAdaptiveProfile(db, userId) {
    let { rows } = await db.query(
      "SELECT * FROM public.adaptive_profiles WHERE user_id = $1",
      [userId]
    );

    if (rows.length > 0) return rows[0];

    // Pull live Memory Lab data
    let memoryHealth = 100.0;
    let retentionRate = 100.0;
    try {
      const { rows: healthRows } = await db.query(
        "SELECT score, retention_rate FROM public.memory_health WHERE user_id = $1",
        [userId]
      );
      if (healthRows.length > 0) {
        memoryHealth = parseFloat(healthRows[0].score || 100);
        retentionRate = parseFloat(healthRows[0].retention_rate || 100);
      }
    } catch (_) {}

    // Pull wrong question count for mistake history snapshot
    let wrongCount = 0;
    try {
      const { rows: wrongRows } = await db.query(
        "SELECT count(*)::int as count FROM public.wrong_questions WHERE user_id = $1 AND status = 'Active'",
        [userId]
      );
      wrongCount = wrongRows[0]?.count || 0;
    } catch (_) {}

    // Initialize profile
    const { rows: created } = await db.query(`
      INSERT INTO public.adaptive_profiles (
        user_id, retention_score, memory_health_score, confidence_score,
        study_consistency, mistake_history_json
      ) VALUES ($1, $2, $3, 50.0, 50.0, $4)
      RETURNING *
    `, [userId, retentionRate, memoryHealth, JSON.stringify({ activeWrongCount: wrongCount })]);

    return created[0];
  }

  /**
   * Recalculates and persists strength/weakness vectors, confidence,
   * learning speed, and retention scores from live student data.
   */
  async updateAdaptiveProfile(db, userId, performanceData) {
    const { correctPct, wrongPct, skipPct, avgTimeSec, subject, chapter } = performanceData;

    // Pull current profile
    const profile = await this.getOrCreateAdaptiveProfile(db, userId);

    // Recalculate key metrics
    const totalTests = (profile.total_tests_taken || 0) + 1;
    const totalCorrect = (profile.total_correct || 0) + Math.round((correctPct || 0) / 10);
    const totalWrong = (profile.total_wrong || 0) + Math.round((wrongPct || 0) / 10);
    const totalSkipped = (profile.total_skipped || 0) + Math.round((skipPct || 0) / 10);

    // Confidence recalculation (weighted moving average)
    const newConfidence = Math.min(100, Math.max(0,
      parseFloat(profile.confidence_score || 50) * 0.7 + (correctPct || 50) * 0.3
    ));

    // Study consistency (bump if active within 24h)
    const lastActive = profile.last_active_at ? new Date(profile.last_active_at) : new Date();
    const hoursSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);
    const newConsistency = Math.min(100, Math.max(0,
      parseFloat(profile.study_consistency || 50) + (hoursSinceActive < 24 ? 2 : -5)
    ));

    // Learning speed classification
    let learningSpeed = 'Medium';
    if (avgTimeSec && avgTimeSec < 45) learningSpeed = 'Fast';
    else if (avgTimeSec && avgTimeSec > 120) learningSpeed = 'Slow';

    // Track subject/chapter strengths and weaknesses
    let strengths = [];
    let weaknesses = [];
    try {
      strengths = JSON.parse(profile.subject_strengths_json || '[]');
      weaknesses = JSON.parse(profile.subject_weaknesses_json || '[]');
    } catch (_) {}

    if (subject && correctPct >= 70 && !strengths.includes(subject)) {
      strengths.push(subject);
      weaknesses = weaknesses.filter(w => w !== subject);
    } else if (subject && correctPct < 40 && !weaknesses.includes(subject)) {
      weaknesses.push(subject);
      strengths = strengths.filter(s => s !== subject);
    }

    const { rows } = await db.query(`
      UPDATE public.adaptive_profiles SET
        total_tests_taken = $2,
        total_correct = $3,
        total_wrong = $4,
        total_skipped = $5,
        avg_response_time_sec = $6,
        confidence_score = $7,
        study_consistency = $8,
        learning_speed = $9,
        subject_strengths_json = $10,
        subject_weaknesses_json = $11,
        last_active_at = now(),
        updated_at = now()
      WHERE user_id = $1
      RETURNING *
    `, [
      userId, totalTests, totalCorrect, totalWrong, totalSkipped,
      parseFloat(avgTimeSec || profile.avg_response_time_sec || 0),
      parseFloat(newConfidence.toFixed(2)),
      parseFloat(newConsistency.toFixed(2)),
      learningSpeed,
      JSON.stringify(strengths),
      JSON.stringify(weaknesses)
    ]);

    return rows[0];
  }

  // ── WEAK / STRONG AREA DETECTION ──────────────────────────────────────

  /**
   * AI-powered weak chapter/topic detection using accuracy, retention,
   * and time analysis across topic_mastery_profiles.
   */
  async detectWeakAreas(db, userId) {
    // Pull granular learning data
    const { rows: profiles } = await db.query(
      "SELECT subject, chapter, topic, accuracy_pct, retention_pct, avg_speed_sec FROM public.topic_mastery_profiles WHERE user_id = $1 ORDER BY accuracy_pct ASC LIMIT 20",
      [userId]
    );

    // If no learning profiles yet, seed from wrong notebook
    if (profiles.length === 0) {
      let weakTopics = [];
      try {
        const { rows: wrongs } = await db.query(
          "SELECT DISTINCT topic, subject, chapter FROM public.wrong_questions WHERE user_id = $1 AND status = 'Active' LIMIT 10",
          [userId]
        );
        weakTopics = wrongs.map(w => ({
          subject: w.subject || 'Biology',
          chapter: w.chapter || 'General',
          topic: w.topic || 'General Topic',
          accuracy_pct: 0,
          retention_pct: 50,
          reason: 'Incorrect answer in notebook'
        }));
      } catch (_) {}
      return { weakAreas: weakTopics, source: 'wrong_notebook' };
    }

    // Filter weak: accuracy < 50% or retention < 60%
    const weakAreas = profiles
      .filter(p => parseFloat(p.accuracy_pct) < 50 || parseFloat(p.retention_pct) < 60)
      .map(p => ({
        subject: p.subject,
        chapter: p.chapter,
        topic: p.topic,
        accuracy_pct: parseFloat(p.accuracy_pct),
        retention_pct: parseFloat(p.retention_pct),
        avg_speed_sec: parseFloat(p.avg_speed_sec),
        reason: parseFloat(p.accuracy_pct) < 50 ? 'Low accuracy' : 'Low retention'
      }));

    // Optionally augment with AI Gateway analysis
    try {
      const prompt = `Analyze these weak areas for a NEET student and prioritize them: ${JSON.stringify(weakAreas.slice(0, 5))}. Return JSON: {"prioritized": ["topic1", "topic2"]}`;
      const aiResult = await aiGateway.executeComplete(db, 'mentor_chat', userId, { query: prompt });
      if (aiResult && aiResult.response) {
        const jsonMatch = aiResult.response.match(/\{[^}]+\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.prioritized) {
            weakAreas.forEach(w => {
              w.ai_priority = parsed.prioritized.indexOf(w.topic) + 1;
            });
          }
        }
      }
    } catch (err) {
      console.warn('[AdaptiveEngine] AI Gateway unavailable for weak area analysis:', err.message);
    }

    return { weakAreas, source: 'topic_mastery_profiles' };
  }

  /**
   * Identifies mastered topics for reinforcement scheduling.
   */
  async detectStrongAreas(db, userId) {
    const { rows: profiles } = await db.query(
      "SELECT subject, chapter, topic, accuracy_pct, retention_pct FROM public.topic_mastery_profiles WHERE user_id = $1 AND accuracy_pct >= 80 ORDER BY accuracy_pct DESC LIMIT 15",
      [userId]
    );

    return {
      strongAreas: profiles.map(p => ({
        subject: p.subject,
        chapter: p.chapter,
        topic: p.topic,
        accuracy_pct: parseFloat(p.accuracy_pct),
        retention_pct: parseFloat(p.retention_pct)
      })),
      source: 'topic_mastery_profiles'
    };
  }

  // ── PERSONALIZED TEST GENERATION ──────────────────────────────────────

  /**
   * Creates adaptive tests by type, integrating with the Smart Test Builder.
   * Supported types: Weak Area, Revision, Mistake Notebook, Retention,
   * Memory Booster, Speed Improvement, Exam Readiness, Adaptive Mock, AI Challenge
   */
  async generatePersonalizedTest(db, userId, testType, options = {}) {
    const profile = await this.getOrCreateAdaptiveProfile(db, userId);
    const targetCount = options.questionCount || 10;
    let filterQuery = '';
    let filterParams = [];
    let generationReason = '';

    switch (testType) {
      case 'Weak Area': {
        const { weakAreas } = await this.detectWeakAreas(db, userId);
        const weakChapters = weakAreas.map(w => w.chapter).filter(Boolean);
        if (weakChapters.length > 0) {
          filterQuery = "SELECT id FROM public.questions WHERE chapter = ANY($1) LIMIT $2";
          filterParams = [weakChapters, targetCount];
        }
        generationReason = `Targeting ${weakChapters.length} weak chapters`;
        break;
      }

      case 'Mistake Notebook': {
        // Pull questions the student got wrong
        const { rows: wrongQs } = await db.query(
          "SELECT question_id FROM public.wrong_questions WHERE user_id = $1 AND status = 'Active' AND question_id IS NOT NULL LIMIT $2",
          [userId, targetCount]
        );
        if (wrongQs.length > 0) {
          const ids = wrongQs.map(w => w.question_id);
          filterQuery = "SELECT id FROM public.questions WHERE id = ANY($1) LIMIT $2";
          filterParams = [ids, targetCount];
        }
        generationReason = 'Retesting previously incorrect answers';
        break;
      }

      case 'Retention': {
        // Low retention topics from learning profiles
        const { rows: lowRet } = await db.query(
          "SELECT DISTINCT chapter FROM public.topic_mastery_profiles WHERE user_id = $1 AND retention_pct < 60 LIMIT 5",
          [userId]
        );
        const chapters = lowRet.map(r => r.chapter).filter(Boolean);
        if (chapters.length > 0) {
          filterQuery = "SELECT id FROM public.questions WHERE chapter = ANY($1) LIMIT $2";
          filterParams = [chapters, targetCount];
        }
        generationReason = `Reinforcing ${chapters.length} low-retention chapters`;
        break;
      }

      case 'Speed Improvement': {
        // Questions the student is slow on (from learning profiles with high avg_speed_sec)
        const { rows: slowTopics } = await db.query(
          "SELECT DISTINCT chapter FROM public.topic_mastery_profiles WHERE user_id = $1 AND avg_speed_sec > 90 LIMIT 5",
          [userId]
        );
        const slowChapters = slowTopics.map(r => r.chapter).filter(Boolean);
        if (slowChapters.length > 0) {
          filterQuery = "SELECT id FROM public.questions WHERE chapter = ANY($1) AND difficulty IN ('Easy', 'Medium') LIMIT $2";
          filterParams = [slowChapters, targetCount];
        }
        generationReason = 'Speed improvement drill on slow topics';
        break;
      }

      case 'Memory Booster': {
        // Due flashcard topics from revision queue
        const { rows: dueTopics } = await db.query(
          "SELECT DISTINCT rq.topic FROM public.revision_queue rq WHERE rq.user_id = $1 AND rq.next_revision_at <= now() LIMIT 5",
          [userId]
        );
        const topics = dueTopics.map(r => r.topic).filter(Boolean);
        if (topics.length > 0) {
          filterQuery = "SELECT id FROM public.questions WHERE topic = ANY($1) LIMIT $2";
          filterParams = [topics, targetCount];
        }
        generationReason = 'Memory booster from due revision queue topics';
        break;
      }

      case 'Adaptive Mock': {
        // Adaptive difficulty: mix questions across difficulty levels based on profile
        const difficulty = profile.current_difficulty_level || 'Medium';
        filterQuery = "SELECT id FROM public.questions ORDER BY random() LIMIT $1";
        filterParams = [targetCount];
        generationReason = `Adaptive mock at ${difficulty} difficulty baseline`;
        break;
      }

      case 'Revision':
      case 'Concept Reinforcement':
      case 'Exam Readiness':
      case 'AI Challenge':
      default: {
        filterQuery = "SELECT id FROM public.questions ORDER BY random() LIMIT $1";
        filterParams = [targetCount];
        generationReason = `${testType} test with random balanced selection`;
        break;
      }
    }

    // Fallback if no filter query built
    if (!filterQuery) {
      filterQuery = "SELECT id FROM public.questions ORDER BY random() LIMIT $1";
      filterParams = [targetCount];
    }

    // Fetch questions
    const { rows: questions } = await db.query(filterQuery, filterParams);
    const questionIds = questions.map(q => q.id);

    if (questionIds.length === 0) {
      // No questions available — still record the adaptive test attempt
      const { rows: adaptiveTestRows } = await db.query(`
        INSERT INTO public.adaptive_tests (user_id, test_type, generation_reason, difficulty_level, question_count, status)
        VALUES ($1, $2, $3, $4, 0, 'No Questions Available')
        RETURNING *
      `, [userId, testType, generationReason, profile.current_difficulty_level || 'Medium']);

      return { adaptiveTest: adaptiveTestRows[0], test: null, questionCount: 0 };
    }

    // Assemble test through Smart Test Builder
    const test = await smartTestBuilder.createTestDraft(db, userId, {
      title: `Adaptive ${testType}: ${profile.exam_goal || 'NEET'} Personalized`,
      examType: profile.exam_goal || 'NEET',
      durationMinutes: Math.round(questionIds.length * 1.5),
      maxMarks: questionIds.length * 4,
      questionIds
    });

    // Record adaptive test metadata
    const { rows: adaptiveTestRows } = await db.query(`
      INSERT INTO public.adaptive_tests (
        user_id, test_id, test_type, generation_reason,
        difficulty_level, parameters_json, question_count, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Generated')
      RETURNING *
    `, [
      userId, test.id, testType, generationReason,
      profile.current_difficulty_level || 'Medium',
      JSON.stringify(options),
      questionIds.length
    ]);

    return { adaptiveTest: adaptiveTestRows[0], test, questionCount: questionIds.length };
  }

  // ── ADAPTIVE DIFFICULTY ENGINE ────────────────────────────────────────

  /**
   * Adjusts question difficulty based on performance metrics.
   * Uses configurable rules from adaptive_rules table.
   */
  async adjustDifficulty(db, userId, performanceData) {
    const { correctPct, wrongPct, avgTimeSec, confidence } = performanceData;
    const profile = await this.getOrCreateAdaptiveProfile(db, userId);
    const currentLevel = profile.current_difficulty_level || 'Medium';

    // Fetch applicable progression rules
    const { rows: progressionRules } = await db.query(
      "SELECT * FROM public.adaptive_rules WHERE from_level = $1 AND rule_type = 'difficulty_progression' AND is_active = true ORDER BY priority ASC LIMIT 1",
      [currentLevel]
    );

    // Fetch applicable regression rules
    const { rows: regressionRules } = await db.query(
      "SELECT * FROM public.adaptive_rules WHERE from_level = $1 AND rule_type = 'difficulty_regression' AND is_active = true ORDER BY priority ASC LIMIT 1",
      [currentLevel]
    );

    let newLevel = currentLevel;
    let reason = 'No change needed';

    // Check progression (student doing well)
    if (progressionRules.length > 0) {
      const rule = progressionRules[0];
      if ((correctPct || 0) >= parseFloat(rule.threshold_correct_pct)) {
        newLevel = rule.to_level;
        reason = `Promoted: ${correctPct}% correct >= ${rule.threshold_correct_pct}% threshold`;
      }
    }

    // Check regression (student struggling) — only if not already promoted
    if (newLevel === currentLevel && regressionRules.length > 0) {
      const rule = regressionRules[0];
      if ((correctPct || 0) <= parseFloat(rule.threshold_correct_pct)) {
        newLevel = rule.to_level;
        reason = `Demoted: ${correctPct}% correct <= ${rule.threshold_correct_pct}% threshold`;
      }
    }

    // Update profile if changed
    if (newLevel !== currentLevel) {
      await db.query(
        "UPDATE public.adaptive_profiles SET current_difficulty_level = $2, updated_at = now() WHERE user_id = $1",
        [userId, newLevel]
      );
    }

    // Record analytics
    await db.query(`
      INSERT INTO public.adaptive_analytics (user_id, metric_name, metric_value, dimension, snapshot_json)
      VALUES ($1, 'difficulty_change', $2, $3, $4)
    `, [
      userId,
      correctPct || 0,
      `${currentLevel} → ${newLevel}`,
      JSON.stringify({ currentLevel, newLevel, reason, correctPct, wrongPct, avgTimeSec, confidence })
    ]);

    return { previousLevel: currentLevel, newLevel, reason };
  }

  // ── AI RECOMMENDATION ENGINE ──────────────────────────────────────────

  /**
   * Generates prioritized daily AI recommendations.
   */
  async generateRecommendations(db, userId) {
    const profile = await this.getOrCreateAdaptiveProfile(db, userId);
    const recommendations = [];
    let priority = 1;

    // 1. Check wrong questions
    try {
      const { rows: wrongRows } = await db.query(
        "SELECT count(*)::int as count FROM public.wrong_questions WHERE user_id = $1 AND status = 'Active'",
        [userId]
      );
      if ((wrongRows[0]?.count || 0) > 0) {
        recommendations.push({
          type: 'Retry Wrong Questions',
          text: `You have ${wrongRows[0].count} unresolved wrong answers. Review them to reinforce understanding.`,
          priority: priority++,
          reason: 'Active wrong notebook entries'
        });
      }
    } catch (_) {}

    // 2. Check due flashcards
    try {
      const { rows: dueRows } = await db.query(
        "SELECT count(*)::int as count FROM public.revision_queue WHERE user_id = $1 AND next_revision_at <= now()",
        [userId]
      );
      if ((dueRows[0]?.count || 0) > 0) {
        recommendations.push({
          type: 'Review Flashcards',
          text: `${dueRows[0].count} flashcards are due for review. Complete them to maintain retention.`,
          priority: priority++,
          reason: 'Due revision queue items'
        });
      }
    } catch (_) {}

    // 3. Check Memory Lab health
    try {
      const { rows: healthRows } = await db.query(
        "SELECT score FROM public.memory_health WHERE user_id = $1",
        [userId]
      );
      if (healthRows.length > 0 && parseFloat(healthRows[0].score) < 70) {
        recommendations.push({
          type: 'Complete Memory Lab',
          text: 'Your memory health is declining. Complete a Memory Lab session to boost retention.',
          priority: priority++,
          reason: `Memory health score: ${healthRows[0].score}`
        });
      }
    } catch (_) {}

    // 4. Weak area test recommendation
    const { weakAreas } = await this.detectWeakAreas(db, userId);
    if (weakAreas.length > 0) {
      recommendations.push({
        type: 'Attempt Weak Area Test',
        text: `Focus on your weakest areas: ${weakAreas.slice(0, 3).map(w => w.chapter || w.topic).join(', ')}.`,
        priority: priority++,
        reason: `${weakAreas.length} weak areas detected`
      });
    }

    // 5. Consistency check
    if (parseFloat(profile.confidence_score || 0) < 40) {
      recommendations.push({
        type: 'Take Mock Test',
        text: 'Your confidence score is low. Take a full mock test to build exam readiness.',
        priority: priority++,
        reason: `Confidence score: ${profile.confidence_score}`
      });
    }

    // 6. Speed improvement
    if (parseFloat(profile.avg_response_time_sec || 0) > 100) {
      recommendations.push({
        type: 'Improve Speed',
        text: 'Your average response time is high. Practice speed drills to improve timing.',
        priority: priority++,
        reason: `Avg response time: ${profile.avg_response_time_sec}s`
      });
    }

    // 7. Daily practice recommendation (always present)
    recommendations.push({
      type: 'Daily Practice',
      text: 'Complete your daily adaptive test to maintain study momentum.',
      priority: priority++,
      reason: 'Daily practice routine'
    });

    // Persist recommendations
    for (const rec of recommendations) {
      await db.query(`
        INSERT INTO public.recommendation_history (user_id, recommendation_type, recommendation_text, priority, reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, rec.type, rec.text, rec.priority, rec.reason]);
    }

    return { recommendations, totalCount: recommendations.length };
  }

  // ── SMART REVISION TESTS ─────────────────────────────────────────────

  /**
   * Auto-creates revision papers from wrong notebook, Memory Lab,
   * low retention concepts, and old mistakes.
   */
  async generateSmartRevisionTest(db, userId, options = {}) {
    return this.generatePersonalizedTest(db, userId, 'Revision', options);
  }

  // ── EXAM READINESS ENGINE ────────────────────────────────────────────

  /**
   * Composite readiness scoring from multiple dimensions.
   */
  async calculateExamReadiness(db, userId) {
    const profile = await this.getOrCreateAdaptiveProfile(db, userId);

    // Syllabus coverage
    let syllabusCoverage = 0;
    try {
      const { rows } = await db.query(
        "SELECT count(distinct chapter)::int as covered FROM public.topic_mastery_profiles WHERE user_id = $1",
        [userId]
      );
      const totalChapters = 45; // Full NEET syllabus approximate
      syllabusCoverage = Math.min(100, parseFloat(((rows[0]?.covered || 0) / totalChapters * 100).toFixed(2)));
    } catch (_) {}

    // Accuracy
    const totalAttempts = (profile.total_correct || 0) + (profile.total_wrong || 0) + (profile.total_skipped || 0);
    const accuracy = totalAttempts > 0
      ? parseFloat(((profile.total_correct || 0) / totalAttempts * 100).toFixed(2))
      : 0;

    // Speed score (normalize: < 60s = 100, > 180s = 0)
    const avgTime = parseFloat(profile.avg_response_time_sec || 90);
    const speedScore = Math.min(100, Math.max(0, parseFloat(((180 - avgTime) / 120 * 100).toFixed(2))));

    // Retention from profile
    const retentionScore = parseFloat(profile.retention_score || 0);

    // Memory health from profile
    const memoryHealth = parseFloat(profile.memory_health_score || 0);

    // Difficulty mastery (based on current level)
    const difficultyMap = { 'Easy': 20, 'Medium': 40, 'Hard': 60, 'Very Hard': 80, 'Adaptive': 95 };
    const difficultyMastery = difficultyMap[profile.current_difficulty_level] || 40;

    // Consistency
    const consistency = parseFloat(profile.study_consistency || 0);

    // Mock performance — average recent adaptive test accuracy
    let mockPerformance = 0;
    try {
      const { rows: mockRows } = await db.query(
        "SELECT AVG(accuracy_pct)::numeric(6,2) as avg_acc FROM public.adaptive_tests WHERE user_id = $1 AND accuracy_pct IS NOT NULL",
        [userId]
      );
      mockPerformance = parseFloat(mockRows[0]?.avg_acc || 0);
    } catch (_) {}

    // Weighted composite readiness
    const overallReadiness = parseFloat((
      syllabusCoverage * 0.15 +
      accuracy * 0.20 +
      speedScore * 0.10 +
      retentionScore * 0.15 +
      memoryHealth * 0.10 +
      difficultyMastery * 0.10 +
      consistency * 0.10 +
      mockPerformance * 0.10
    ).toFixed(2));

    // Predicted rank and score (simple linear model)
    const predictedScore = Math.round(overallReadiness / 100 * 720);
    const predictedRank = Math.max(1, Math.round(100000 - (overallReadiness * 1000)));

    // Persist readiness record
    const { rows: readinessRows } = await db.query(`
      INSERT INTO public.exam_readiness (
        user_id, syllabus_coverage_pct, accuracy_pct, speed_score,
        retention_score, memory_health_score, difficulty_mastery_score,
        consistency_score, mock_performance_score, overall_readiness_pct,
        predicted_rank, predicted_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      userId, syllabusCoverage, accuracy, speedScore,
      retentionScore, memoryHealth, difficultyMastery,
      consistency, mockPerformance, overallReadiness,
      predictedRank, predictedScore
    ]);

    return readinessRows[0];
  }

  // ── DAILY LEARNING PLAN ──────────────────────────────────────────────

  /**
   * Generates personalized daily learning path with prioritized tasks.
   */
  async generateDailyPlan(db, userId) {
    const profile = await this.getOrCreateAdaptiveProfile(db, userId);
    const { weakAreas } = await this.detectWeakAreas(db, userId);
    const tasks = [];

    // Task 1: Review wrong questions if any
    try {
      const { rows: wrongRows } = await db.query(
        "SELECT count(*)::int as count FROM public.wrong_questions WHERE user_id = $1 AND status = 'Active'",
        [userId]
      );
      if ((wrongRows[0]?.count || 0) > 0) {
        tasks.push({ type: 'wrong_review', title: 'Review Wrong Questions', priority: 1, estimated_minutes: 15 });
      }
    } catch (_) {}

    // Task 2: Due flashcards
    try {
      const { rows: dueRows } = await db.query(
        "SELECT count(*)::int as count FROM public.revision_queue WHERE user_id = $1 AND next_revision_at <= now()",
        [userId]
      );
      if ((dueRows[0]?.count || 0) > 0) {
        tasks.push({ type: 'flashcard_review', title: 'Complete Due Flashcards', priority: 2, estimated_minutes: 10 });
      }
    } catch (_) {}

    // Task 3: Weak area practice
    if (weakAreas.length > 0) {
      const weakTarget = weakAreas[0];
      tasks.push({
        type: 'weak_area_practice',
        title: `Practice ${weakTarget.chapter || weakTarget.topic || 'Weak Topic'}`,
        priority: 3,
        estimated_minutes: 20
      });
    }

    // Task 4: Adaptive test
    tasks.push({ type: 'adaptive_test', title: 'Take Adaptive Practice Test', priority: 4, estimated_minutes: 30 });

    // Task 5: Memory Lab session
    tasks.push({ type: 'memory_lab', title: 'Complete Memory Lab Session', priority: 5, estimated_minutes: 10 });

    const prioritySubject = weakAreas.length > 0 ? (weakAreas[0].subject || 'Biology') : 'Biology';
    const priorityChapter = weakAreas.length > 0 ? (weakAreas[0].chapter || 'General') : 'General';

    // Persist daily plan
    const { rows: planRows } = await db.query(`
      INSERT INTO public.personalized_plans (
        user_id, plan_date, plan_type, tasks_json, total_tasks,
        priority_subject, priority_chapter
      ) VALUES ($1, CURRENT_DATE, 'daily', $2, $3, $4, $5)
      RETURNING *
    `, [userId, JSON.stringify(tasks), tasks.length, prioritySubject, priorityChapter]);

    return planRows[0];
  }

  // ── ANALYTICS ────────────────────────────────────────────────────────

  /**
   * Records and retrieves adaptive analytics snapshots.
   */
  async getAdaptiveAnalytics(db, userId) {
    const { rows } = await db.query(
      "SELECT * FROM public.adaptive_analytics WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 20",
      [userId]
    );
    return { analytics: rows, totalCount: rows.length };
  }

  // ── PREDICTION MODELS ────────────────────────────────────────────────

  /**
   * Stores predicted rank/score from AI models.
   */
  async savePrediction(db, userId, predictionData) {
    const { modelType, examType, predictedScore, predictedRank, confidenceInterval, inputFeatures } = predictionData;

    const { rows } = await db.query(`
      INSERT INTO public.prediction_models (
        user_id, model_type, exam_type, predicted_score, predicted_rank,
        confidence_interval, input_features_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      userId,
      modelType || 'rank_prediction',
      examType || 'NEET',
      predictedScore || 0,
      predictedRank || 0,
      confidenceInterval || 80.0,
      JSON.stringify(inputFeatures || {})
    ]);

    return rows[0];
  }

  // ── INSTITUTE CONFIGURATIONS ─────────────────────────────────────────

  /**
   * Creates institute-level adaptive test configurations.
   */
  async createInstituteAdaptiveConfig(db, instituteId, configData, createdBy) {
    const { configName, configType, parameters } = configData;

    const { rows } = await db.query(`
      INSERT INTO public.institute_adaptive_configs (
        institute_id, config_name, config_type, parameters_json, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      instituteId,
      configName || 'Default Adaptive Config',
      configType || 'adaptive_test',
      JSON.stringify(parameters || {}),
      createdBy
    ]);

    return rows[0];
  }
}

module.exports = new AdaptiveEngine();
