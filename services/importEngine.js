const assessmentEngine = require('./assessmentEngine');

/**
 * Enterprise Question Import Ingestion Engine
 */
class ImportEngine {

  /**
   * Registers a new import uploader job
   */
  async createImportJob(db, uploaderId, fileName, totalRows, priority = 'Medium') {
    const { rows: jobRows } = await db.query(`
      INSERT INTO public.import_jobs (uploader_id, file_name, total_rows, status)
      VALUES ($1, $2, $3, 'Queued')
      RETURNING *
    `, [uploaderId, fileName, totalRows]);

    const job = jobRows[0];

    await db.query(`
      INSERT INTO public.import_queue (job_id, priority)
      VALUES ($1, $2)
    `, [job.id, priority]);

    return job;
  }

  /**
   * Smart Column Header Detection & AI cleanups
   */
  detectAndCleanHeaders(rawRow) {
    const mapped = {};
    const cleaningLog = [];

    // Header mappings map variations to standard names
    const mappings = {
      questionText: ['question', 'question text', 'ques', 'q_text'],
      optionA: ['option a', 'option_a', 'a', 'opt a'],
      optionB: ['option b', 'option_b', 'b', 'opt b'],
      optionC: ['option c', 'option_c', 'c', 'opt c'],
      optionD: ['option d', 'option_d', 'd', 'opt d'],
      correctAnswer: ['correct answer', 'correct_answer', 'ans', 'correct option'],
      subject: ['subject', 'sub', 'course'],
      chapter: ['chapter', 'chapter name', 'chap'],
      topic: ['topic', 'topic name'],
      difficulty: ['difficulty', 'difficulty level', 'diff'],
      explanation: ['explanation', 'explanation text', 'exp'],
      questionNumber: ['question number', 'question_number', 'qno', 'num'],
      explanationImage: ['explanation image', 'explanation_image', 'explanation_image_url', 'explanation image url', 'image_url', 'image url', 'solution_image', 'solution image']
    };

    // Clean keys and match
    for (const key of Object.keys(rawRow)) {
      const cleanKey = key.trim().toLowerCase();
      let matched = false;

      for (const [standardKey, list] of Object.entries(mappings)) {
        if (list.includes(cleanKey)) {
          // Clean value
          let val = rawRow[key];
          if (typeof val === 'string') {
            const originalVal = val;
            val = val.replace(/\s+/g, ' ').trim(); // automatic extra whitespace cleaning
            if (val !== originalVal) {
              cleaningLog.push(`Removed extra spaces in header "${standardKey}": "${originalVal}" -> "${val}"`);
            }
          }
          mapped[standardKey] = val;
          matched = true;
          break;
        }
      }

      if (!matched) {
        mapped[key] = rawRow[key];
      }
    }

    return { mapped, cleaningLog };
  }

  /**
   * Pre-validates row schema properties
   */
  validateImportRow(rowNumber, r) {
    const errors = [];

    if (!r.questionText) {
      errors.push({ rowNumber, column: 'Question', message: 'Missing required Question text.' });
    }
    if (!r.optionA || !r.optionB || !r.optionC || !r.optionD) {
      errors.push({ rowNumber, column: 'Options', message: 'All Options A, B, C, and D must be populated.' });
    }
    if (!r.correctAnswer) {
      errors.push({ rowNumber, column: 'Correct Answer', message: 'Missing Correct Answer option choice.' });
    } else if (!['A', 'B', 'C', 'D'].includes(r.correctAnswer.toString().toUpperCase().trim())) {
      errors.push({ rowNumber, column: 'Correct Answer', message: `Invalid Correct Answer option value: "${r.correctAnswer}". Must be one of A, B, C, D.` });
    }

    return errors;
  }

  /**
   * Ingests and processes import batch rows sequentially
   */
  async processImportJobRows(db, jobId, rowsArray) {
    // 1. Update job status to Processing
    await db.query(
      "UPDATE public.import_jobs SET status = 'Processing' WHERE id = $1",
      [jobId]
    );

    const { rows: jobs } = await db.query(
      "SELECT uploader_id FROM public.import_jobs WHERE id = $1",
      [jobId]
    );
    const uploaderId = jobs[0]?.uploader_id;

    let imported = 0;
    let rejected = 0;
    let duplicates = 0;

    for (let i = 0; i < rowsArray.length; i++) {
      const rowNum = i + 1;
      const rawRow = rowsArray[i];

      // Smart mapping headers & clean extra spaces
      const { mapped, cleaningLog } = this.detectAndCleanHeaders(rawRow);

      // Perform validation checks
      const rowErrors = this.validateImportRow(rowNum, mapped);

      if (rowErrors.length > 0) {
        rejected++;
        for (const err of rowErrors) {
          await db.query(`
            INSERT INTO public.import_errors (job_id, row_number, column_name, error_message)
            VALUES ($1, $2, $3, $4)
          `, [jobId, rowNum, err.column, err.message]);
        }

        await db.query(`
          INSERT INTO public.import_rows (job_id, raw_row_data_json, status, error_message)
          VALUES ($1, $2, 'Rejected', $3)
        `, [jobId, JSON.stringify(rawRow), rowErrors[0].message]);

        continue;
      }

      // Check duplicates fingerprint
      const hash = assessmentEngine.generateQuestionHash(mapped.questionText);
      const { rows: dupRows } = await db.query(
        "SELECT id FROM public.questions WHERE md5(question_text) = $1 LIMIT 1",
        [hash]
      );

      if (dupRows.length > 0) {
        duplicates++;
        await db.query(`
          INSERT INTO public.import_rows (job_id, raw_row_data_json, status, error_message)
          VALUES ($1, $2, 'Duplicate', 'Duplicate question fingerprint detected.')
        `, [jobId, JSON.stringify(rawRow)]);
        continue;
      }

      // Safe creation inside bank
      try {
        const question = await assessmentEngine.createQuestion(db, uploaderId, mapped);
        imported++;

        await db.query(`
          INSERT INTO public.import_rows (job_id, raw_row_data_json, status, processed_question_id)
          VALUES ($1, $2, 'Imported', $3)
        `, [jobId, JSON.stringify(rawRow), question.id]);

      } catch (err) {
        rejected++;
        await db.query(`
          INSERT INTO public.import_errors (job_id, row_number, error_message)
          VALUES ($1, $2, $3)
        `, [jobId, rowNum, err.message]);

        await db.query(`
          INSERT INTO public.import_rows (job_id, raw_row_data_json, status, error_message)
          VALUES ($1, $2, 'Rejected', $3)
        `, [jobId, JSON.stringify(rawRow), err.message]);
      }
    }

    // 2. Remove job from active queue
    await db.query("DELETE FROM public.import_queue WHERE job_id = $1", [jobId]);

    // 3. Mark completed
    const { rows: completedJob } = await db.query(`
      UPDATE public.import_jobs 
      SET status = 'Completed', imported_rows = $1, rejected_rows = $2, duplicates_count = $3
      WHERE id = $4
      RETURNING *
    `, [imported, rejected, duplicates, jobId]);

    return completedJob[0];
  }

  /**
   * Entire Import Ingestion Transactional Rollback Engine
   */
  async rollbackImportJob(db, jobId) {
    const { rows: job } = await db.query(
      "SELECT * FROM public.import_jobs WHERE id = $1",
      [jobId]
    );

    if (job.length === 0) {
      throw new Error(`Import Job ${jobId} not found.`);
    }

    if (!job[0].rollback_available) {
      throw new Error(`Rollback is not available for job ${jobId}.`);
    }

    // Query all imported question IDs associated with this job
    const { rows: rowsToRollback } = await db.query(
      "SELECT processed_question_id FROM public.import_rows WHERE job_id = $1 AND processed_question_id IS NOT NULL",
      [jobId]
    );

    const questionIds = rowsToRollback.map(r => r.processed_question_id);

    if (questionIds.length > 0) {
      console.log(`[Rollback Engine] Purging ${questionIds.length} questions for Job: ${jobId}`);

      // Transactional delete metadata, audits, history and parent questions
      const idsStr = questionIds.map((_, i) => `$${i + 1}`).join(',');

      await db.query(`DELETE FROM public.question_metadata WHERE question_id IN (${idsStr})`, questionIds);
      await db.query(`DELETE FROM public.question_audit WHERE question_id IN (${idsStr})`, questionIds);
      await db.query(`DELETE FROM public.question_history WHERE question_id IN (${idsStr})`, questionIds);
      await db.query(`DELETE FROM public.questions WHERE id IN (${idsStr})`, questionIds);
    }

    // Update job status to Cancelled and mark rollback done
    const { rows: rolledBack } = await db.query(`
      UPDATE public.import_jobs
      SET status = 'Cancelled', rollback_available = FALSE
      WHERE id = $1
      RETURNING *
    `, [jobId]);

    return rolledBack[0];
  }

  /**
   * Retrieves downloadable templates list
   */
  async getTemplatesCatalog(db) {
    const { rows } = await db.query("SELECT * FROM public.import_templates ORDER BY created_at");
    return rows;
  }

  /**
   * Aggregates uploader analytics and quality graphs
   */
  async getImportDashboardAnalytics(db) {
    const { rows: jobs } = await db.query("SELECT * FROM public.import_jobs ORDER BY created_at DESC LIMIT 20");
    const { rows: totalRows } = await db.query("SELECT COALESCE(SUM(total_rows), 0)::int as total FROM public.import_jobs");
    const { rows: importedRows } = await db.query("SELECT COALESCE(SUM(imported_rows), 0)::int as imported FROM public.import_jobs");

    return {
      totalUploadedQuestionsCount: totalRows[0].total,
      successIngestedQuestionsCount: importedRows[0].imported,
      jobsHistory: jobs
    };
  }

  /**
   * Query validation rule checklists
   */
  async getJobErrorsList(db, jobId) {
    const { rows } = await db.query(
      "SELECT * FROM public.import_errors WHERE job_id = $1 ORDER BY row_number",
      [jobId]
    );
    return rows;
  }
}

module.exports = new ImportEngine();
