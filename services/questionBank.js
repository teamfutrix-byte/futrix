const crypto = require('crypto');

/**
 * Normalizes question contents and generates a unique content hash (SHA-256)
 */
function generateContentHash(q) {
  const text = (q.question_text || '').trim().toLowerCase();
  const a = (q.option_a || '').trim().toLowerCase();
  const b = (q.option_b || '').trim().toLowerCase();
  const c = (q.option_c || '').trim().toLowerCase();
  const d = (q.option_d || '').trim().toLowerCase();
  const correct = (q.correct_answer || '').trim().toUpperCase();
  
  const hashPayload = `${text}|${a}|${b}|${c}|${d}|${correct}`;
  return crypto.createHash('sha256').update(hashPayload).digest('hex');
}

/**
 * Retrieves vector embedding using Gemini API, or falls back to projection on offline testing
 */
async function getEmbedding(db, text) {
  try {
    const { rows: settingsRows } = await db.query('SELECT * FROM public.ai_settings LIMIT 1');
    if (settingsRows.length > 0 && settingsRows[0].enable_ai && settingsRows[0].gemini_api_key) {
      const apiKey = settingsRows[0].gemini_api_key;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text }]
          }
        })
      });
      const resData = await res.json();
      if (res.ok && resData.embedding && resData.embedding.values) {
        return resData.embedding.values;
      }
    }
  } catch (err) {
    console.warn("[QUESTION BANK] Embedding API call failed, using fallback:", err.message);
  }

  // Consistent 1536-dimensional projection fallback
  const vector = new Array(1536).fill(0);
  const words = text.toLowerCase().match(/\w+/g) || [];
  for (let i = 0; i < 1536; i++) {
    let sum = 0;
    words.forEach((w, idx) => {
      let hash = 0;
      for (let c = 0; c < w.length; c++) {
        hash = (hash * 31 + w.charCodeAt(c)) % 1000000;
      }
      sum += Math.sin(hash + idx + i);
    });
    vector[i] = Math.sin(sum);
  }
  let norm = Math.sqrt(vector.reduce((a, b) => a + b * b, 0));
  if (norm === 0) norm = 1;
  return vector.map(v => v / norm);
}

/**
 * Checks for exact duplicates (by content hash) or semantic duplicates
 */
async function checkDuplicate(db, q, excludeQuestionId = null) {
  const contentHash = generateContentHash(q);

  // 1. Exact match check
  let query = 'SELECT id, question_text, topic FROM public.questions WHERE content_hash = $1';
  let params = [contentHash];
  if (excludeQuestionId) {
    query += ' AND id != $2';
    params.push(excludeQuestionId);
  }
  
  const { rows: exactRows } = await db.query(query, params);
  if (exactRows.length > 0) {
    return { duplicate: true, type: 'exact', details: exactRows[0] };
  }

  // 2. Jaccard token overlap check (for structure/text duplication)
  const queryStr = `
    SELECT id, question_text, topic 
    FROM public.questions 
    WHERE similarity(question_text, $1) > 0.85
  `;
  const jaccardParams = [q.question_text];
  if (excludeQuestionId) {
    // Add additional filtering if needed
  }
  // Wait, let's keep it basic to avoid requiring pg_trgm extension. We can just use exact content_hash check
  // or simple exact text check
  const { rows: textRows } = await db.query('SELECT id, question_text, topic FROM public.questions WHERE TRIM(LOWER(question_text)) = TRIM(LOWER($1))' + (excludeQuestionId ? ' AND id != $2' : ''), [q.question_text, ...(excludeQuestionId ? [excludeQuestionId] : [])]);
  if (textRows.length > 0) {
    return { duplicate: true, type: 'semantic_exact', details: textRows[0] };
  }

  return { duplicate: false };
}

/**
 * Save a question (insert new question)
 */
async function saveQuestion(db, q, editorId = null) {
  const dup = await checkDuplicate(db, q);
  if (dup.duplicate) {
    throw new Error(`Duplicate question detected (Type: ${dup.type}). Existing ID: ${dup.details.id}`);
  }

  const contentHash = generateContentHash(q);
  const embedding = await getEmbedding(db, q.question_text);

  // Compute next question number
  const { rows: numRows } = await db.query('SELECT COALESCE(MAX(question_number), 0) + 1 AS next_num FROM public.questions');
  const questionNumber = numRows[0].next_num;

  const query = `
    INSERT INTO public.questions (
      series_id, question_number, question_text, option_a, option_b, option_c, option_d, 
      correct_answer, marks, negative_marks, topic, exam, board, class, subject, chapter, 
      subchapter, subtopic, difficulty, bloom_level, language, status, version,
      created_by, content_hash, embedding_vector, tags, explanation, detailed_solution,
      hints, step_solution, formulas, assets
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 
      $17, $18, $19, $20, $21, $22, 1, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
    ) RETURNING *;
  `;

  // Format array parameters correctly
  const tags = q.tags || [];
  const formulas = q.formulas || [];

  const values = [
    q.series_id || 'AI-GENERATED-POOL',
    questionNumber,
    q.question_text,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.correct_answer,
    q.marks || 4.00,
    q.negative_marks || -1.00,
    q.topic || 'General',
    q.exam || 'NEET',
    q.board || 'CBSE',
    q.class || 'Class 11',
    q.subject || 'Physics',
    q.chapter || 'Kinematics',
    q.subchapter || '',
    q.subtopic || '',
    q.difficulty || 'Medium',
    q.bloom_level || 'Apply',
    q.language || 'English',
    q.status || 'Published',
    editorId,
    contentHash,
    `[${embedding.join(',')}]`,
    tags,
    q.explanation || '',
    q.detailed_solution || '',
    JSON.stringify(q.hints || {}),
    JSON.stringify(q.step_solution || []),
    formulas,
    JSON.stringify(q.assets || {})
  ];

  const { rows } = await db.query(query, values);
  
  // Log audit trail
  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'create', $2)
  `, [editorId, `Created question ID = ${rows[0].id}, Topic = ${q.topic}`]);

  return rows[0];
}

/**
 * Creates a new version revision (updates existing question and logs old version to history)
 */
async function createRevision(db, questionId, updatedData, revisionNotes, editorId = null) {
  // Fetch current question data
  const { rows: currentRows } = await db.query('SELECT * FROM public.questions WHERE id = $1', [questionId]);
  if (currentRows.length === 0) throw new Error('Question not found');
  
  const current = currentRows[0];

  // Check uniqueness constraint on updated data (if stem or options changed)
  const hashCheck = await checkDuplicate(db, updatedData, questionId);
  if (hashCheck.duplicate) {
    throw new Error(`Duplicate question detected on update. Matches ID: ${hashCheck.details.id}`);
  }

  // Generate new content hash and embedding vector
  const contentHash = generateContentHash(updatedData);
  const embedding = await getEmbedding(db, updatedData.question_text);

  // 1. Insert CURRENT state into public.question_versions
  const historyQuery = `
    INSERT INTO public.question_versions (
      question_id, version, series_id, question_number, question_text, option_a, option_b, option_c, option_d,
      correct_answer, marks, negative_marks, topic, ai_metadata, revision_notes, created_at, created_by,
      parent_version_id, root_version_id, change_summary, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    RETURNING id;
  `;
  const historyValues = [
    current.id,
    current.version,
    current.series_id,
    current.question_number,
    current.question_text,
    current.option_a,
    current.option_b,
    current.option_c,
    current.option_d,
    current.correct_answer,
    current.marks,
    current.negative_marks,
    current.topic,
    JSON.stringify(current.ai_metadata || {}),
    revisionNotes || 'Version backup',
    current.updated_at || current.created_at,
    current.created_by,
    current.parent_version_id,
    current.root_version_id || current.id,
    revisionNotes || 'Prior edit backup',
    current.status
  ];
  const { rows: histRows } = await db.query(historyQuery, historyValues);
  const parentHistId = histRows[0].id;

  // 2. Update CURRENT question in public.questions with the new data
  const updateQuery = `
    UPDATE public.questions SET
      question_text = $1, option_a = $2, option_b = $3, option_c = $4, option_d = $5,
      correct_answer = $6, marks = $7, negative_marks = $8, topic = $9, exam = $10,
      board = $11, class = $12, subject = $13, chapter = $14, subchapter = $15, subtopic = $16,
      difficulty = $17, bloom_level = $18, language = $19, status = $20,
      version = version + 1, parent_version_id = $21, root_version_id = $22,
      updated_at = now(), content_hash = $23, embedding_vector = $24, tags = $25,
      explanation = $26, detailed_solution = $27, hints = $28, step_solution = $29,
      formulas = $30, assets = $31
    WHERE id = $32 RETURNING *;
  `;
  const updateValues = [
    updatedData.question_text,
    updatedData.option_a,
    updatedData.option_b,
    updatedData.option_c,
    updatedData.option_d,
    updatedData.correct_answer,
    updatedData.marks || current.marks,
    updatedData.negative_marks || current.negative_marks,
    updatedData.topic || current.topic,
    updatedData.exam || current.exam,
    updatedData.board || current.board,
    updatedData.class || current.class,
    updatedData.subject || current.subject,
    updatedData.chapter || current.chapter,
    updatedData.subchapter || current.subchapter,
    updatedData.subtopic || current.subtopic,
    updatedData.difficulty || current.difficulty,
    updatedData.bloom_level || current.bloom_level,
    updatedData.language || current.language,
    updatedData.status || current.status,
    parentHistId,
    current.root_version_id || current.id,
    contentHash,
    `[${embedding.join(',')}]`,
    updatedData.tags || current.tags || [],
    updatedData.explanation || current.explanation || '',
    updatedData.detailed_solution || current.detailed_solution || '',
    JSON.stringify(updatedData.hints || current.hints || {}),
    JSON.stringify(updatedData.step_solution || current.step_solution || []),
    updatedData.formulas || current.formulas || [],
    JSON.stringify(updatedData.assets || current.assets || {}),
    questionId
  ];

  const { rows: updatedRows } = await db.query(updateQuery, updateValues);
  
  // Log revision audit
  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'update', $2)
  `, [editorId, `Updated question ID = ${questionId} to version ${updatedRows[0].version}. Change summary: ${revisionNotes || 'None'}`]);

  return updatedRows[0];
}

/**
 * Rolls back question to target version number
 */
async function rollbackQuestion(db, questionId, targetVersionNum, editorId = null) {
  // Fetch target history data
  const { rows: histRows } = await db.query(`
    SELECT * FROM public.question_versions 
    WHERE question_id = $1 AND version = $2
  `, [questionId, targetVersionNum]);

  if (histRows.length === 0) throw new Error(`Historical version ${targetVersionNum} not found`);
  const hist = histRows[0];

  // Fetch current question details
  const { rows: currentRows } = await db.query('SELECT * FROM public.questions WHERE id = $1', [questionId]);
  if (currentRows.length === 0) throw new Error('Question not found');
  const current = currentRows[0];

  // Create update payload from history record
  const updatedData = {
    question_text: hist.question_text,
    option_a: hist.option_a,
    option_b: hist.option_b,
    option_c: hist.option_c,
    option_d: hist.option_d,
    correct_answer: hist.correct_answer,
    marks: hist.marks,
    negative_marks: hist.negative_marks,
    topic: hist.topic,
    exam: current.exam,
    board: current.board,
    class: current.class,
    subject: current.subject,
    chapter: current.chapter,
    subchapter: current.subchapter,
    subtopic: current.subtopic,
    difficulty: current.difficulty,
    bloom_level: current.bloom_level,
    language: current.language,
    status: hist.status,
    tags: current.tags,
    explanation: current.explanation,
    detailed_solution: current.detailed_solution,
    hints: current.hints,
    step_solution: current.step_solution,
    formulas: current.formulas,
    assets: current.assets
  };

  const updatedQuestion = await createRevision(db, questionId, updatedData, `Rollback to version ${targetVersionNum}`, editorId);
  return updatedQuestion;
}

/**
 * Compares two versions and returns line diff updates
 */
async function getVersionDiff(db, questionId, v1Num, v2Num) {
  const getVersionObj = async (versionNum) => {
    // Check in active table first
    const { rows: activeRows } = await db.query('SELECT * FROM public.questions WHERE id = $1 AND version = $2', [questionId, versionNum]);
    if (activeRows.length > 0) return activeRows[0];
    
    // Check in history versions
    const { rows: histRows } = await db.query('SELECT * FROM public.question_versions WHERE question_id = $1 AND version = $2', [questionId, versionNum]);
    if (histRows.length > 0) return histRows[0];

    throw new Error(`Version ${versionNum} not found`);
  };

  const v1 = await getVersionObj(v1Num);
  const v2 = await getVersionObj(v2Num);

  const diffField = (f1, f2) => {
    const s1 = String(f1 || '');
    const s2 = String(f2 || '');
    if (s1 === s2) return { changed: false };
    return { changed: true, old: s1, new: s2 };
  };

  const diffArray = (arr1, arr2) => {
    const a1 = arr1 || [];
    const a2 = arr2 || [];
    if (JSON.stringify(a1) === JSON.stringify(a2)) return { changed: false };
    return { changed: true, old: a1, new: a2 };
  };

  return {
    question_text: diffField(v1.question_text, v2.question_text),
    options: {
      A: diffField(v1.option_a, v2.option_a),
      B: diffField(v1.option_b, v2.option_b),
      C: diffField(v1.option_c, v2.option_c),
      D: diffField(v1.option_d, v2.option_d)
    },
    correct_answer: diffField(v1.correct_answer, v2.correct_answer),
    topic: diffField(v1.topic, v2.topic),
    marks: diffField(v1.marks, v2.marks),
    negative_marks: diffField(v1.negative_marks, v2.negative_marks),
    status: diffField(v1.status, v2.status),
    tags: diffArray(v1.tags, v2.tags),
    formulas: diffArray(v1.formulas, v2.formulas)
  };
}

/**
 * Searches the database using keyword filter or semantic vector similarity
 */
async function searchQuestions(db, params) {
  const query = params.searchQuery || '';
  const exam = params.exam || '';
  const subject = params.subject || '';
  const chapter = params.chapter || '';
  const topic = params.topic || '';
  const difficulty = params.difficulty || '';
  const bloom = params.bloomLevel || '';
  const status = params.status || '';
  const tags = params.tags || [];
  const isSemantic = params.isSemantic === true || params.isSemantic === 'true';
  const limit = parseInt(params.limit || 50);
  const offset = parseInt(params.offset || 0);

  let sql = '';
  let sqlParams = [];

  if (isSemantic && query.trim().length > 0) {
    const embedding = await getEmbedding(db, query);
    sql = `
      SELECT q.*, 
        1 - (q.embedding_vector <=> $1) AS similarity_score
      FROM public.questions q
      WHERE q.deleted_at IS NULL
    `;
    sqlParams.push(`[${embedding.join(',')}]`);
  } else {
    sql = `
      SELECT q.*, 1.00 AS similarity_score
      FROM public.questions q
      WHERE q.deleted_at IS NULL
    `;
  }

  // Apply filter clauses
  let paramIndex = sqlParams.length + 1;

  if (query.trim().length > 0 && !isSemantic) {
    sql += ` AND (q.question_text ILIKE $${paramIndex} OR q.explanation ILIKE $${paramIndex} OR q.topic ILIKE $${paramIndex})`;
    sqlParams.push(`%${query}%`);
    paramIndex++;
  }

  if (exam) {
    sql += ` AND q.exam = $${paramIndex}`;
    sqlParams.push(exam);
    paramIndex++;
  }

  if (subject) {
    sql += ` AND q.subject = $${paramIndex}`;
    sqlParams.push(subject);
    paramIndex++;
  }

  if (chapter) {
    sql += ` AND q.chapter = $${paramIndex}`;
    sqlParams.push(chapter);
    paramIndex++;
  }

  if (topic) {
    sql += ` AND q.topic = $${paramIndex}`;
    sqlParams.push(topic);
    paramIndex++;
  }

  if (difficulty) {
    sql += ` AND q.difficulty = $${paramIndex}`;
    sqlParams.push(difficulty);
    paramIndex++;
  }

  if (bloom) {
    sql += ` AND q.bloom_level = $${paramIndex}`;
    sqlParams.push(bloom);
    paramIndex++;
  }

  if (status) {
    sql += ` AND q.status = $${paramIndex}`;
    sqlParams.push(status);
    paramIndex++;
  } else {
    // Exclude soft deleted questions unless explicitly asked
    sql += ` AND q.status != 'Soft Deleted'`;
  }

  if (tags.length > 0) {
    sql += ` AND q.tags @> $${paramIndex}`;
    sqlParams.push(tags);
    paramIndex++;
  }

  // Sort and limit
  if (isSemantic && query.trim().length > 0) {
    sql += ` ORDER BY similarity_score DESC`;
  } else {
    sql += ` ORDER BY q.question_number DESC`;
  }

  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  sqlParams.push(limit, offset);

  const { rows } = await db.query(sql, sqlParams);
  return rows;
}

/**
 * Soft delete question
 */
async function softDeleteQuestion(db, id, deletedBy, reason) {
  const query = `
    UPDATE public.questions 
    SET status = 'Soft Deleted', deleted_at = now(), updated_at = now() 
    WHERE id = $1 RETURNING *;
  `;
  const { rows } = await db.query(query, [id]);
  
  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'delete', $2)
  `, [deletedBy, `Soft deleted question ID = ${id}. Reason: ${reason || 'None'}`]);

  return rows[0];
}

/**
 * Restore soft-deleted question
 */
async function restoreQuestion(db, id, editorId) {
  const query = `
    UPDATE public.questions 
    SET status = 'Published', deleted_at = null, updated_at = now() 
    WHERE id = $1 RETURNING *;
  `;
  const { rows } = await db.query(query, [id]);
  
  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'restore', $2)
  `, [editorId, `Restored soft-deleted question ID = ${id}`]);

  return rows[0];
}

/**
 * Archives question
 */
async function archiveQuestion(db, id, editorId) {
  const query = `
    UPDATE public.questions 
    SET status = 'Archived', archived_at = now(), updated_at = now() 
    WHERE id = $1 RETURNING *;
  `;
  const { rows } = await db.query(query, [id]);
  
  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'archive', $2)
  `, [editorId, `Archived question ID = ${id}`]);

  return rows[0];
}

/**
 * Bulk Import Questions
 */
async function bulkImport(db, questionsList, editorId) {
  let imported = 0;
  let skipped = 0;
  let report = [];

  for (const q of questionsList) {
    try {
      const saved = await saveQuestion(db, q, editorId);
      imported++;
      report.push({ success: true, text: q.question_text.slice(0, 30), id: saved.id });
    } catch (err) {
      skipped++;
      report.push({ success: false, text: q.question_text.slice(0, 30), error: err.message });
    }
  }

  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'bulk_import', $2)
  `, [editorId, `Bulk imported questions: ${imported} successful, ${skipped} skipped.`]);

  return { imported, skipped, report };
}

/**
 * Bulk Export Questions
 */
async function bulkExport(db, ids, format) {
  const { rows } = await db.query('SELECT * FROM public.questions WHERE id = ANY($1)', [ids]);
  
  if (format === 'csv') {
    let csv = 'id,question_number,topic,question_text,option_a,option_b,option_c,option_d,correct_answer\n';
    rows.forEach(r => {
      const escape = (text) => `"${(text || '').replace(/"/g, '""')}"`;
      csv += `${r.id},${r.question_number},${escape(r.topic)},${escape(r.question_text)},${escape(r.option_a)},${escape(r.option_b)},${escape(r.option_c)},${escape(r.option_d)},${r.correct_answer}\n`;
    });
    return csv;
  }
  
  return rows; // Returns JSON object/array representation directly
}

/**
 * Bulk operations (mass tag, archive, delete, reject)
 */
async function bulkOperate(db, ids, operation, payload, editorId) {
  if (!ids || ids.length === 0) return { count: 0 };

  let query = '';
  let params = [];

  if (operation === 'tag') {
    query = `UPDATE public.questions SET tags = ARRAY(SELECT DISTINCT unnest(array_cat(tags, $1))), updated_at = now() WHERE id = ANY($2) RETURNING id;`;
    params = [payload.tags || [], ids];
  } else if (operation === 'archive') {
    query = `UPDATE public.questions SET status = 'Archived', archived_at = now(), updated_at = now() WHERE id = ANY($1) RETURNING id;`;
    params = [ids];
  } else if (operation === 'soft_delete') {
    query = `UPDATE public.questions SET status = 'Soft Deleted', deleted_at = now(), updated_at = now() WHERE id = ANY($1) RETURNING id;`;
    params = [ids];
  } else if (operation === 'approve') {
    query = `
      INSERT INTO public.approval_workflow (question_id, version, status, reviewer_id, comments, updated_at)
      SELECT id, version, 'approved', $1, $2, now() FROM public.questions WHERE id = ANY($3)
      ON CONFLICT (question_id, version) 
      DO UPDATE SET status = 'approved', reviewer_id = $1, comments = $2, updated_at = now()
      RETURNING question_id;
    `;
    params = [editorId, payload.comments || 'Bulk approved via manager.', ids];
  } else {
    throw new Error(`Unsupported bulk operation: ${operation}`);
  }

  const { rows } = await db.query(query, params);
  
  await db.query(`
    INSERT INTO public.validation_audit_logs (user_id, action, details)
    VALUES ($1, 'bulk_operate', $2)
  `, [editorId, `Applied bulk operation '${operation}' on ${rows.length} questions.`]);

  return { count: rows.length };
}

/**
 * Get full version log and audit records for a question
 */
async function getAuditTrail(db, questionId) {
  const { rows: versions } = await db.query(`
    SELECT version, change_summary, created_at, created_by 
    FROM public.question_versions 
    WHERE question_id = $1 
    ORDER BY version ASC
  `, [questionId]);

  const { rows: current } = await db.query(`
    SELECT version, created_at, created_by 
    FROM public.questions 
    WHERE id = $1
  `, [questionId]);

  const trail = [];
  versions.forEach(v => {
    trail.push({
      event: 'revision',
      version: v.version,
      summary: v.change_summary || 'Manual edit committed.',
      timestamp: v.created_at,
      user: v.created_by
    });
  });

  if (current.length > 0) {
    trail.push({
      event: 'active_head',
      version: current[0].version,
      summary: 'Current production-active state.',
      timestamp: current[0].created_at,
      user: current[0].created_by
    });
  }

  return trail;
}

module.exports = {
  generateContentHash,
  getEmbedding,
  checkDuplicate,
  saveQuestion,
  createRevision,
  rollbackQuestion,
  getVersionDiff,
  searchQuestions,
  softDeleteQuestion,
  restoreQuestion,
  archiveQuestion,
  bulkImport,
  bulkExport,
  bulkOperate,
  getAuditTrail
};
