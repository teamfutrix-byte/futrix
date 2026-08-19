const crypto = require('crypto');

/**
 * Enterprise Assessment Intelligence Engine (AIE) Core Service
 */
class AssessmentEngine {

  /**
   * Generates unique search fingerprints for question deduplication
   */
  generateQuestionHash(text) {
    if (!text) return '';
    return crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
  }

  /**
   * Creates a single question and initializes metadata/audit trails
   */
  async createQuestion(db, uploaderId, q) {
    const duplicateHash = this.generateQuestionHash(q.questionText);

    // 1. Check for duplicates in existing bank
    const { rows: dups } = await db.query(
      "SELECT id FROM public.questions WHERE md5(question_text) = $1 LIMIT 1",
      [duplicateHash]
    );
    if (dups.length > 0) {
      throw new Error(`Duplicate question detected with duplicate hash index: ${duplicateHash}`);
    }

    // 2. Insert question
    const { rows: inserted } = await db.query(`
      INSERT INTO public.questions (
        series_id, question_number, question_text, option_a, option_b, option_c, option_d,
        correct_answer, marks, negative_marks, topic, subject, chapter, sub_topic, difficulty, explanation, hint, assets
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      q.seriesId || 'TEST-SERIES-AIE',
      q.questionNumber || 1,
      q.questionText,
      q.optionA,
      q.optionB,
      q.optionC,
      q.optionD,
      q.correctAnswer || 'A',
      q.marks || 4.00,
      q.negativeMarks || -1.00,
      q.topic || 'General Topic',
      q.subject || 'Biology',
      q.chapter || 'General',
      q.subTopic || 'General Subtopic',
      q.difficulty || 'Medium',
      q.explanation || 'No explanation provided.',
      q.hint || '',
      JSON.stringify(q.explanationImage ? { explanation_image: q.explanationImage } : (q.assets || {}))
    ]);

    const newQ = inserted[0];

    // 3. Initialize Metadata ledger
    await db.query(`
      INSERT INTO public.question_metadata (question_id)
      VALUES ($1)
    `, [newQ.id]);

    // 4. Log Audit Trail
    await db.query(`
      INSERT INTO public.question_audit (question_id, user_id, action, details_json)
      VALUES ($1, $2, 'Created', $3)
    `, [newQ.id, uploaderId, JSON.stringify({ duplicateHash })]);

    // 5. Log History Event
    await db.query(`
      INSERT INTO public.question_history (question_id, action_type, state_to)
      VALUES ($1, 'Created', 'Draft')
    `, [newQ.id]);

    return newQ;
  }

  /**
   * Transitions a question through its lifecycle states
   */
  async transitionQuestionState(db, userId, questionId, newState) {
    const { rows: current } = await db.query(
      "SELECT status FROM public.questions WHERE id = $1",
      [questionId]
    );
    if (current.length === 0) {
      throw new Error(`Question ${questionId} not found.`);
    }

    const stateFrom = current[0].status;

    const { rows } = await db.query(`
      UPDATE public.questions 
      SET status = $1 
      WHERE id = $2
      RETURNING *
    `, [newState, questionId]);

    // Log History Event
    await db.query(`
      INSERT INTO public.question_history (question_id, action_type, state_from, state_to)
      VALUES ($1, 'StateTransitioned', $2, $3)
    `, [questionId, stateFrom, newState]);

    // Log Audit Trail
    await db.query(`
      INSERT INTO public.question_audit (question_id, user_id, action, details_json)
      VALUES ($1, $2, 'StateTransition', $3)
    `, [questionId, userId, JSON.stringify({ stateFrom, stateTo: newState })]);

    return rows[0];
  }

  /**
   * Search Questions (Autocomplete & Full-text filters)
   */
  async searchQuestions(db, queryStr, filters = {}) {
    let sql = "SELECT * FROM public.questions WHERE 1=1";
    const params = [];

    if (queryStr) {
      params.push(`%${queryStr}%`);
      sql += ` AND (question_text ILIKE $${params.length} OR topic ILIKE $${params.length} OR chapter ILIKE $${params.length})`;
    }

    if (filters.subject) {
      params.push(filters.subject);
      sql += ` AND subject = $${params.length}`;
    }

    if (filters.difficulty) {
      params.push(filters.difficulty);
      sql += ` AND difficulty = $${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }

    sql += " ORDER BY created_at DESC LIMIT 50";

    const { rows } = await db.query(sql, params);
    return rows;
  }

  /**
   * Bulk Upload Questions asynchronously
   */
  async bulkUploadQuestions(db, uploaderId, fileName, questionsArray) {
    // 1. Create upload session log
    const { rows: uploadSession } = await db.query(`
      INSERT INTO public.question_uploads (uploader_id, file_name, status)
      VALUES ($1, $2, 'Pending')
      RETURNING id
    `, [uploaderId, fileName]);

    const uploadId = uploadSession[0].id;
    let added = 0;
    let dups = 0;

    // Asynchronously insert questions (using simple loop for sequential safety)
    for (const q of questionsArray) {
      try {
        await this.createQuestion(db, uploaderId, q);
        added++;
      } catch (err) {
        if (err.message.includes('Duplicate')) {
          dups++;
        } else {
          console.error("- Bulk insert error:", err.message);
        }
      }
    }

    // 2. Update upload log status
    await db.query(`
      UPDATE public.question_uploads 
      SET questions_added = $1, duplicates_count = $2, status = 'Processed'
      WHERE id = $3
    `, [added, dups, uploadId]);

    return {
      uploadId,
      questionsAdded: added,
      duplicatesCount: dups
    };
  }

  /**
   * Retrieves category list hierarchy
   */
  async getCategoriesHierarchy(db) {
    const { rows } = await db.query("SELECT * FROM public.question_categories ORDER BY level, category_name");
    return rows;
  }

  /**
   * Aggregates dashboard analytics
   */
  async getAssessmentDashboard(db) {
    const { rows: statusBreakdown } = await db.query(`
      SELECT status, count(*)::int as count 
      FROM public.questions 
      GROUP BY status
    `);

    const { rows: totalQuestions } = await db.query("SELECT count(*)::int as count FROM public.questions");
    const { rows: uploads } = await db.query("SELECT * FROM public.question_uploads ORDER BY created_at DESC LIMIT 5");

    return {
      totalQuestionsCount: totalQuestions[0]?.count || 0,
      statusBreakdown,
      recentUploads: uploads
    };
  }

  /**
   * Question audit log history query
   */
  async getQuestionAuditLogs(db, questionId = null) {
    let sql = "SELECT * FROM public.question_audit";
    const params = [];
    if (questionId) {
      params.push(questionId);
      sql += " WHERE question_id = $1";
    }
    sql += " ORDER BY created_at DESC LIMIT 50";

    const { rows } = await db.query(sql, params);
    return rows;
  }
}

module.exports = new AssessmentEngine();
