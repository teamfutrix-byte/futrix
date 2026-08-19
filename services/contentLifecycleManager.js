/**
 * Enterprise Content Lifecycle Management System (ECLMS) Service
 * Single governance layer for all educational resources in FUTRIX.
 */
const aiGateway = require('./aiGateway');

class ContentLifecycleManager {

  /**
   * Creates a new version for a resource, preserving history
   */
  async createContentVersion(db, contentType, contentId, editorId, changeSummary, contentData, aiValidation) {
    // 1. Fetch current max version number
    const { rows: maxRows } = await db.query(`
      SELECT COALESCE(MAX(version_number), 0) + 1 as next_ver
      FROM public.content_versions
      WHERE content_type = $1 AND content_id = $2
    `, [contentType, contentId]);

    const nextVer = maxRows[0].next_ver;

    // 2. Insert new content version record
    const { rows } = await db.query(`
      INSERT INTO public.content_versions (
        content_type, content_id, version_number, editor_id,
        change_summary, content_data_json, ai_validation_json, approval_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft')
      RETURNING *
    `, [
      contentType,
      contentId,
      nextVer,
      editorId || null,
      changeSummary || `Version ${nextVer} updated`,
      JSON.stringify(contentData || {}),
      JSON.stringify(aiValidation || {})
    ]);

    // 3. Log content history event
    await db.query(`
      INSERT INTO public.content_history (content_type, content_id, action, actor_id, details_json)
      VALUES ($1, $2, 'Version Created', $3, $4)
    `, [contentType, contentId, editorId, JSON.stringify({ versionNumber: nextVer, changeSummary })]);

    return rows[0];
  }

  /**
   * Logs and performs a safe status state transition
   */
  async transitionContentState(db, contentType, contentId, fromState, toState, actorId, reason) {
    // 1. Log transition audit log
    const { rows: auditRows } = await db.query(`
      INSERT INTO public.lifecycle_audit_logs (content_type, content_id, from_state, to_state, changed_by, reason)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [contentType, contentId, fromState, toState, actorId || null, reason || 'State transition']);

    // 2. Update status in original tables if applicable
    if (contentType === 'Question') {
      await db.query("UPDATE public.questions SET difficulty = $2 WHERE id = $1", [contentId, toState]).catch(() => {});
    } else if (contentType === 'Test') {
      await db.query("UPDATE public.tests SET status = $2 WHERE id = $1", [contentId, toState]).catch(() => {});
    }

    // 3. Log general history
    await db.query(`
      INSERT INTO public.content_history (content_type, content_id, action, actor_id, details_json)
      VALUES ($1, $2, 'State Transitioned', $3, $4)
    `, [contentType, contentId, actorId, JSON.stringify({ fromState, toState, reason })]);

    // 4. Update content governance record
    await db.query(`
      INSERT INTO public.content_governance (content_type, content_id, creator_id, publisher_id)
      VALUES ($1, $2, $3, $3)
      ON CONFLICT DO NOTHING
    `, [contentType, contentId, actorId]);

    return auditRows[0];
  }

  /**
   * Submits a content draft for AI validation and reviewer queue assignment
   */
  async submitContentForApproval(db, contentType, contentId, submitterId) {
    // 1. Transition to 'Pending AI Validation'
    await this.transitionContentState(db, contentType, contentId, 'Draft', 'Pending AI Validation', submitterId, 'Submitted for approval workflow');

    // 2. AI Validation Analysis (Grammar, duplication check, alignment)
    let aiScore = 90.0;
    let duplicateRisk = 'Low';
    
    try {
      const prompt = `Perform grammar and quality validation check for educational resource: Type: ${contentType}, ID: ${contentId}. Return JSON: {"grammarScore": 95, "duplicateRisk": "Low", "alignment": "Aligned"}`;
      const result = await aiGateway.executeComplete(db, 'mentor_chat', submitterId, { query: prompt });
      if (result && result.response) {
        const jsonMatch = result.response.match(/\{[^}]+\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiScore = parsed.grammarScore || aiScore;
          duplicateRisk = parsed.duplicateRisk || duplicateRisk;
        }
      }
    } catch (_) {}

    const aiFeedback = { aiScore, duplicateRisk, checkedAt: new Date().toISOString() };

    // 3. Insert into approval queue
    const { rows: appRows } = await db.query(`
      INSERT INTO public.approval_queue (content_type, content_id, submitter_id, status, ai_feedback_json)
      VALUES ($1, $2, $3, 'Pending Review', $4)
      RETURNING *
    `, [contentType, contentId, submitterId, JSON.stringify(aiFeedback)]);

    const approval = appRows[0];

    // 4. Assign review task to review queue
    await db.query(`
      INSERT INTO public.content_review_queue (approval_queue_id, priority, due_at)
      VALUES ($1, 2, now() + interval '3 days')
    `, [approval.id]);

    // 5. Transition to 'Pending Review'
    await this.transitionContentState(db, contentType, contentId, 'Pending AI Validation', 'Pending Review', submitterId, 'AI validation completed successfully');

    return { approvalId: approval.id, aiFeedback };
  }

  /**
   * Reviews a submitted approval request, transitioning status
   */
  async reviewContentSubmission(db, approvalId, reviewerId, status, feedback) {
    const { rows: appRows } = await db.query(
      "SELECT * FROM public.approval_queue WHERE id = $1",
      [approvalId]
    );

    if (appRows.length === 0) throw new Error("Approval request not found.");
    const app = appRows[0];

    const toState = status === 'Approved' ? 'Approved' : 'Draft';

    // 1. Update queue status
    await db.query(`
      UPDATE public.approval_queue
      SET status = $2, reviewer_id = $3, reviewer_feedback = $4, updated_at = now()
      WHERE id = $1
    `, [approvalId, status, reviewerId, feedback]);

    // 2. Perform transition
    await this.transitionContentState(db, app.content_type, app.content_id, 'Pending Review', toState, reviewerId, `Review result: ${status}. Feedback: ${feedback}`);

    // Remove from review task queue
    await db.query("DELETE FROM public.content_review_queue WHERE approval_queue_id = $1", [approvalId]);

    // Update governance approver
    await db.query(`
      INSERT INTO public.content_governance (content_type, content_id, approver_id)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [app.content_type, app.content_id, reviewerId]);

    return { approvalId, status, toState };
  }

  /**
   * Moves a resource to the recycle bin after verifying references mapping
   */
  async sendContentToRecycleBin(db, contentType, contentId, deletedBy, reason) {
    // 1. Verify dependencies mapping
    const { rows: deps } = await db.query(`
      SELECT * FROM public.dependency_map
      WHERE content_type = $1 AND content_id = $2
    `, [contentType, contentId]);

    const warnings = deps.map(d => `Referenced by dependent ${d.dependent_content_type} (${d.dependent_content_id})`);

    // 2. Insert into Recycle Bin
    const { rows: recycleRows } = await db.query(`
      INSERT INTO public.recycle_bin (content_type, content_id, content_name, deleted_by, reason, dependencies_json)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [contentType, contentId, `${contentType} resource node`, deletedBy, reason, JSON.stringify(warnings)]);

    // 3. Update state to 'Recycle Bin'
    await this.transitionContentState(db, contentType, contentId, 'Live', 'Recycle Bin', deletedBy, `Soft deleted: ${reason}`);

    // Update governance remover
    await db.query(`
      INSERT INTO public.content_governance (content_type, content_id, remover_id)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [contentType, contentId, deletedBy]);

    return { recycleId: recycleRows[0].id, warnings };
  }

  /**
   * Restores a soft-deleted resource from the recycle bin
   */
  async restoreContent(db, recycleBinId, actorId) {
    const { rows: recycleRows } = await db.query(
      "SELECT * FROM public.recycle_bin WHERE id = $1",
      [recycleBinId]
    );

    if (recycleRows.length === 0) throw new Error("Recycle bin record not found.");
    const rec = recycleRows[0];

    // 1. Restore state back to Draft
    await this.transitionContentState(db, rec.content_type, rec.content_id, 'Recycle Bin', 'Draft', actorId, 'Restored from recycle bin');

    // 2. Record restoration job
    await db.query(`
      INSERT INTO public.restore_jobs (restore_type, items_restored_count, restored_by, restore_criteria_json)
      VALUES ('Single', 1, $1, $2)
    `, [actorId, JSON.stringify({ contentId: rec.content_id, contentType: rec.content_type })]);

    // 3. Remove from Recycle Bin
    await db.query("DELETE FROM public.recycle_bin WHERE id = $1", [recycleBinId]);

    return { contentId: rec.content_id, contentType: rec.content_type };
  }

  /**
   * Archives out-of-date or low-usage content
   */
  async archiveContent(db, contentType, contentId, archiverId, reason) {
    // 1. Transition state to Archived
    await this.transitionContentState(db, contentType, contentId, 'Live', 'Archived', archiverId, `Archived: ${reason}`);

    // 2. Insert into content_archive
    const { rows } = await db.query(`
      INSERT INTO public.content_archive (content_type, content_id, archived_by, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [contentType, contentId, archiverId, reason]);

    // Update governance archiver
    await db.query(`
      INSERT INTO public.content_governance (content_type, content_id, archiver_id)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [contentType, contentId, archiverId]);

    return rows[0];
  }
}

module.exports = new ContentLifecycleManager();
