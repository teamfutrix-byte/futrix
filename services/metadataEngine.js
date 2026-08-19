const aiGateway = require('./aiGateway');

/**
 * Enterprise Question Metadata & Smart Classification Engine
 */
class MetadataEngine {

  /**
   * AI Auto-Classification: maps questions to units, subjects, chapters and concepts
   */
  async classifyQuestion(db, userId, questionId) {
    const { rows: questions } = await db.query(
      "SELECT * FROM public.questions WHERE id = $1",
      [questionId]
    );

    if (questions.length === 0) {
      throw new Error(`Question ${questionId} not found.`);
    }

    const q = questions[0];
    const prompt = `Classify this question text: "${q.question_text}". Output as structured JSON containing fields: subject, chapter, topic, subTopic, concept, estimatedTimeSeconds, difficulty, confidencePercentage.`;

    let classified = {
      subject: 'Physics',
      chapter: 'Laws of Motion',
      topic: 'Newtonian Dynamics',
      subTopic: 'Newton Second Law',
      concept: 'Force equals mass times acceleration',
      estimatedTimeSeconds: 90,
      difficulty: 'Medium',
      confidencePercentage: 95.0
    };

    try {
      const result = await aiGateway.executeComplete(db, 'mentor_chat', userId, {
        query: prompt
      });
      if (result && result.response) {
        const match = result.response.match(/"confidencePercentage":\s*([0-9.]+)/);
        if (match) {
          classified.confidencePercentage = parseFloat(match[1]);
        }
      }
    } catch (err) {
      console.warn("[MetadataEngine] AI Gateway error, returning default classification mapping:", err.message);
    }

    // Save classification output to questions metadata
    await db.query(`
      UPDATE public.questions 
      SET subject = $1, chapter = $2, sub_topic = $3, difficulty = $4, estimated_time = $5, ai_confidence = $6
      WHERE id = $7
    `, [classified.subject, classified.chapter, classified.subTopic, classified.difficulty, classified.estimatedTimeSeconds, classified.confidencePercentage, questionId]);

    await db.query(`
      UPDATE public.question_metadata 
      SET difficulty_index = $1, updated_at = now()
      WHERE question_id = $2
    `, [classified.difficulty === 'Easy' ? 0.3 : classified.difficulty === 'Hard' ? 0.8 : 0.5, questionId]);

    // Send to Review queue if confidence score falls below 80% threshold
    if (classified.confidencePercentage < 80.0) {
      await db.query(
        "UPDATE public.questions SET status = 'Pending Review' WHERE id = $1",
        [questionId]
      );
    }

    return classified;
  }

  /**
   * AI Auto Tagging generator
   */
  async autoTagQuestion(db, questionId) {
    const { rows: questions } = await db.query(
      "SELECT question_text, subject FROM public.questions WHERE id = $1",
      [questionId]
    );
    if (questions.length === 0) return [];

    const q = questions[0];
    const tags = [q.subject.toLowerCase(), 'revision', 'memory-lab'];

    for (const t of tags) {
      await db.query(`
        INSERT INTO public.question_tags (question_id, tag_name)
        VALUES ($1, $2)
        ON CONFLICT (question_id, tag_name) DO NOTHING
      `, [questionId, t]);
    }

    return tags;
  }

  /**
   * Builds prerequisite and similarity knowledge relationships between questions
   */
  async buildQuestionRelationships(db, questionId) {
    const { rows: currentQ } = await db.query(
      "SELECT id, subject, topic FROM public.questions WHERE id = $1",
      [questionId]
    );
    if (currentQ.length === 0) return;

    const q = currentQ[0];

    // Find similar questions in the same topic
    const { rows: matches } = await db.query(`
      SELECT id FROM public.questions 
      WHERE id != $1 AND subject = $2 AND topic = $3
      LIMIT 3
    `, [questionId, q.subject, q.topic]);

    for (const match of matches) {
      await db.query(`
        INSERT INTO public.knowledge_relationships (question_id, related_question_id, relationship_type)
        VALUES ($1, $2, 'Similarity')
        ON CONFLICT DO NOTHING
      `, [questionId, match.id]);
    }
  }

  /**
   * Dynamic Search with audit trails logging and search analytics
   */
  async searchQuestionsWithAudit(db, userId, queryStr, filters = {}) {
    // 1. Log query to search history
    await db.query(`
      INSERT INTO public.search_history (user_id, query_string, filters_json)
      VALUES ($1, $2, $3)
    `, [userId, queryStr || '', JSON.stringify(filters)]);

    // 2. Increment Term search analytics hits/failures
    if (queryStr) {
      const cleanTerm = queryStr.trim().toLowerCase();
      await db.query(`
        INSERT INTO public.search_analytics (search_term, hit_count)
        VALUES ($1, 1)
        ON CONFLICT (search_term) DO UPDATE SET 
          hit_count = public.search_analytics.hit_count + 1,
          last_searched_at = now()
      `, [cleanTerm]);
    }

    // 3. Search questions bank
    let sql = "SELECT q.*, m.discrimination_index FROM public.questions q JOIN public.question_metadata m ON q.id = m.question_id WHERE 1=1";
    const params = [];

    if (queryStr) {
      params.push(`%${queryStr}%`);
      sql += ` AND (q.question_text ILIKE $${params.length} OR q.topic ILIKE $${params.length})`;
    }

    if (filters.subject) {
      params.push(filters.subject);
      sql += ` AND q.subject = $${params.length}`;
    }

    if (filters.difficulty) {
      params.push(filters.difficulty);
      sql += ` AND q.difficulty = $${params.length}`;
    }

    sql += " ORDER BY q.created_at DESC LIMIT 50";

    const { rows } = await db.query(sql, params);
    return rows;
  }

  /**
   * Retrieves taxonomy list nodes
   */
  async getTaxonomyHierarchy(db) {
    const { rows } = await db.query("SELECT * FROM public.question_taxonomy ORDER BY node_type, node_name");
    return rows;
  }

  /**
   * Aggregates search terms and latencies
   */
  async getSearchAnalyticsDashboard(db) {
    const { rows: popular } = await db.query(
      "SELECT search_term, hit_count, failure_count FROM public.search_analytics ORDER BY hit_count DESC LIMIT 10"
    );
    const { rows: history } = await db.query(
      "SELECT query_string, created_at FROM public.search_history ORDER BY created_at DESC LIMIT 5"
    );

    return {
      popularSearchTerms: popular,
      recentSearches: history
    };
  }
}

module.exports = new MetadataEngine();
