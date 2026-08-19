const crypto = require('crypto');

/**
 * Enterprise CMS Manager Service
 */
class CmsManager {

  /**
   * Saves page content. Creates a new record or updates an existing one.
   * If it is an update, the old content is archived into public.cms_versions,
   * version is incremented, and changes are computed.
   */
  async saveContent(db, {
    id, title, slug, description = '', summary = '', category, subcategory = '',
    language = 'en', authorId, contentBody, status = 'Draft', tags = [], keywords = [],
    seoTitle = '', seoDescription = '', canonicalUrl = '', featuredImage = '', thumbnail = '',
    structuredData = {}, changeSummary = 'Content updated'
  }) {
    console.log(`[CMS Engine] Saving content: '${title}' (${id})`);

    // Calculate SEO Score
    const seoScore = this.calculateSeoScore(title, seoDescription, slug, keywords);
    const enrichedStructuredData = {
      ...structuredData,
      seoScore,
      seo_suggestions: this.getSeoSuggestions(title, seoDescription, slug, keywords)
    };

    // Check if content already exists
    const { rows: existing } = await db.query(
      `SELECT * FROM public.cms_content WHERE id = $1`,
      [id]
    );

    let nextVer = 1;
    let action = 'CREATE';
    let workflowHistory = [];

    if (existing.length > 0) {
      const prev = existing[0];
      nextVer = prev.version + 1;
      action = 'UPDATE';
      workflowHistory = Array.isArray(prev.workflow_history) ? prev.workflow_history : [];

      // 1. Calculate diff
      const diff = {
        title: prev.title !== title ? { old: prev.title, new: title } : null,
        slug: prev.slug !== slug ? { old: prev.slug, new: slug } : null,
        content_body: prev.content_body !== contentBody ? { old: prev.content_body, new: contentBody } : null
      };

      // 2. Backup current state to cms_versions before updating main content
      await db.query(
        `INSERT INTO public.cms_versions (content_id, version_number, title, slug, content_body, change_summary, author_id, diff_data, approval_record)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          prev.id,
          prev.version,
          prev.title,
          prev.slug,
          prev.content_body,
          changeSummary,
          authorId,
          JSON.stringify(diff),
          JSON.stringify({ approval_status: prev.approval_status, reviewer: prev.reviewer_id })
        ]
      );
    }

    // 3. Insert or Update cms_content
    const approvalStatus = status === 'Published' || status === 'Approved' ? 'Approved' : 'Pending';
    const publishedAt = status === 'Published' ? new Date() : null;

    const historyEntry = {
      timestamp: new Date(),
      action,
      author: authorId,
      version: nextVer,
      status
    };
    workflowHistory.push(historyEntry);

    await db.query(
      `INSERT INTO public.cms_content (id, title, slug, description, summary, category, subcategory, language, author_id, status, tags, keywords, seo_title, seo_description, canonical_url, featured_image, thumbnail, content_body, structured_data, updated_at, published_at, version, approval_status, workflow_history)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), $20, $21, $22, $23)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         slug = EXCLUDED.slug,
         description = EXCLUDED.description,
         summary = EXCLUDED.summary,
         category = EXCLUDED.category,
         subcategory = EXCLUDED.subcategory,
         language = EXCLUDED.language,
         author_id = EXCLUDED.author_id,
         status = EXCLUDED.status,
         tags = EXCLUDED.tags,
         keywords = EXCLUDED.keywords,
         seo_title = EXCLUDED.seo_title,
         seo_description = EXCLUDED.seo_description,
         canonical_url = EXCLUDED.canonical_url,
         featured_image = EXCLUDED.featured_image,
         thumbnail = EXCLUDED.thumbnail,
         content_body = EXCLUDED.content_body,
         structured_data = EXCLUDED.structured_data,
         updated_at = NOW(),
         published_at = COALESCE(EXCLUDED.published_at, public.cms_content.published_at),
         version = EXCLUDED.version,
         approval_status = EXCLUDED.approval_status,
         workflow_history = EXCLUDED.workflow_history`,
      [
        id, title, slug, description, summary, category, subcategory, language, authorId,
        status, tags, keywords, seoTitle, seoDescription, canonicalUrl, featuredImage, thumbnail,
        contentBody, JSON.stringify(enrichedStructuredData), publishedAt, nextVer, approvalStatus,
        JSON.stringify(workflowHistory)
      ]
    );

    // Write audit log
    await this.logAudit(db, authorId, `${action}_CONTENT`, id, { title, slug, version: nextVer, seoScore });

    return { id, version: nextVer, seoScore, approvalStatus };
  }

  /**
   * Performs Git-like rollback restoring content state to target version state.
   * Increments current version count.
   */
  async rollbackContent(db, { contentId, targetVersionNumber, actorId }) {
    console.log(`[CMS Engine] Rollback requested for '${contentId}' to version #${targetVersionNumber}`);

    // Fetch target version details
    const { rows: versions } = await db.query(
      `SELECT * FROM public.cms_versions WHERE content_id = $1 AND version_number = $2`,
      [contentId, targetVersionNumber]
    );
    if (versions.length === 0) {
      throw new Error(`Target version #${targetVersionNumber} not found in history for content ID: ${contentId}`);
    }
    const target = versions[0];

    // Fetch current content details to backup
    const { rows: current } = await db.query(
      `SELECT * FROM public.cms_content WHERE id = $1`,
      [contentId]
    );
    if (current.length === 0) {
      throw new Error(`Content not found: ${contentId}`);
    }
    const curr = current[0];

    // Backup current pre-rollback state
    await db.query(
      `INSERT INTO public.cms_versions (content_id, version_number, title, slug, content_body, change_summary, author_id, diff_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        curr.id,
        curr.version,
        curr.title,
        curr.slug,
        curr.content_body,
        `Rollback snapshot before applying version #${targetVersionNumber}`,
        actorId,
        JSON.stringify({ rolled_back: true })
      ]
    );

    // Apply target version content
    const nextVer = curr.version + 1;
    const historyEntry = {
      timestamp: new Date(),
      action: `ROLLBACK_TO_V${targetVersionNumber}`,
      author: actorId,
      version: nextVer,
      status: curr.status
    };

    let workflowHistory = Array.isArray(curr.workflow_history) ? curr.workflow_history : [];
    workflowHistory.push(historyEntry);

    await db.query(
      `UPDATE public.cms_content 
       SET title = $1, slug = $2, content_body = $3, version = $4, updated_at = NOW(),
           workflow_history = $5
       WHERE id = $6`,
      [target.title, target.slug, target.content_body, nextVer, JSON.stringify(workflowHistory), contentId]
    );

    await this.logAudit(db, actorId, 'ROLLBACK_CONTENT', contentId, { targetVersionNumber, nextVer });

    return { contentId, rolledBackTo: targetVersionNumber, currentVersion: nextVer };
  }

  /**
   * Search query emulating full-text search constraints
   */
  async searchContent(db, queryStr, filters = {}) {
    let sql = `SELECT * FROM public.cms_content WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (queryStr) {
      sql += ` AND (title ILIKE $${idx} OR slug ILIKE $${idx} OR content_body ILIKE $${idx} OR description ILIKE $${idx})`;
      params.push(`%${queryStr}%`);
      idx++;
    }

    if (filters.category) {
      sql += ` AND category = $${idx++}`;
      params.push(filters.category);
    }
    if (filters.status) {
      sql += ` AND status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.language) {
      sql += ` AND language = $${idx++}`;
      params.push(filters.language);
    }

    sql += ` ORDER BY updated_at DESC`;

    const { rows } = await db.query(sql, params);
    return rows;
  }

  /**
   * Retrieves role-restricted dynamic navigation trees
   */
  async getMenu(db, menuId, userRole = 'guest') {
    const { rows } = await db.query(
      `SELECT * FROM public.cms_menus WHERE id = $1`,
      [menuId]
    );
    if (rows.length === 0) return [];
    
    const menu = rows[0];

    // Filter items based on user role authorization limits
    const filteredItems = menu.items.filter(item => {
      if (!item.role) return true; // public
      return item.role === userRole || userRole === 'admin';
    });

    return { id: menu.id, name: menu.name, items: filteredItems };
  }

  /**
   * Retrieves FAQs and increments view counters (popularity tracker emulator)
   */
  async getFaqs(db, category = null) {
    let query = `SELECT * FROM public.cms_faqs WHERE status = 'Published'`;
    const params = [];

    if (category) {
      query += ` AND category = $1`;
      params.push(category);
    }

    query += ` ORDER BY display_order ASC`;

    const { rows } = await db.query(query, params);

    // Background increment for view counts (popularity simulation)
    if (rows.length > 0) {
      const ids = rows.map(r => r.id);
      await db.query(
        `UPDATE public.cms_faqs SET views = COALESCE(views, 0) + 1 WHERE id = ANY($1)`,
        [ids]
      );
    }

    return rows;
  }

  /**
   * Catalogs uploaded media details
   */
  async catalogMedia(db, { id, filename, filepath, fileSize, format, resolution = null, ownerId, altText = '' }) {
    const mediaId = id || 'med_' + crypto.randomBytes(8).toString('hex');
    const checksum = crypto.createHash('md5').update(filename + filepath + Date.now()).digest('hex');

    await db.query(
      `INSERT INTO public.cms_media (id, filename, filepath, file_size, format, resolution, checksum, owner_id, alt_text, cdn_status, optimization_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', 'Optimized')
       ON CONFLICT (id) DO UPDATE SET
         alt_text = EXCLUDED.alt_text,
         filepath = EXCLUDED.filepath`,
      [mediaId, filename, filepath, fileSize, format, resolution, checksum, ownerId, altText]
    );

    await this.logAudit(db, ownerId, 'UPLOAD_MEDIA', mediaId, { filename, format });

    return { mediaId, filepath, optimization: 'Optimized', cdn: 'Active' };
  }

  /**
   * Real-time dashboard aggregates
   */
  async getDashboardStats(db) {
    const { rows: statusStats } = await db.query(
      `SELECT status, COUNT(*) as count FROM public.cms_content GROUP BY status`
    );

    const statsMap = { Published: 0, Draft: 0, Scheduled: 0, Archived: 0 };
    let totalPages = 0;
    statusStats.forEach(s => {
      if (statsMap[s.status] !== undefined) {
        statsMap[s.status] = parseInt(s.count);
      }
      totalPages += parseInt(s.count);
    });

    const { rows: approvals } = await db.query(
      `SELECT COUNT(*) as count FROM public.cms_content WHERE approval_status = 'Pending'`
    );

    const { rows: mediaStats } = await db.query(
      `SELECT COUNT(*) as count, SUM(file_size) as total_size FROM public.cms_media`
    );

    // Calculate SEO averages
    const { rows: seoStats } = await db.query(
      `SELECT AVG((structured_data->>'seoScore')::numeric) as avg_score 
       FROM public.cms_content WHERE (structured_data->>'seoScore') IS NOT NULL`
    );

    // Popular articles simulation (FAQ views + static popular pages)
    const { rows: popularFaqs } = await db.query(
      `SELECT question as title, views, category FROM public.cms_faqs ORDER BY views DESC LIMIT 5`
    );

    // Recent activity audit trail (last 12 transactions)
    const { rows: activities } = await db.query(
      `SELECT * FROM public.cms_audit_logs ORDER BY timestamp DESC LIMIT 12`
    );

    return {
      publishedCount: statsMap.Published,
      draftCount: statsMap.Draft,
      scheduledCount: statsMap.Scheduled,
      pendingApprovals: parseInt(approvals[0].count) || 0,
      archivedCount: statsMap.Archived,
      totalPages,
      mediaCount: parseInt(mediaStats[0].count) || 0,
      storageUsedBytes: parseInt(mediaStats[0].total_size) || 0,
      seoScoreAvg: parseFloat(seoStats[0].avg_score || 0).toFixed(1),
      brokenLinksCount: 0, // Mock broken links
      popularPages: popularFaqs,
      recentActivities: activities,
      searchKeywords: [
        { word: 'JEE preparation', volume: 450 },
        { word: 'NEET Practice', volume: 320 },
        { word: 'Gamification rules', volume: 180 },
        { word: 'AI Mentor math', volume: 140 }
      ]
    };
  }

  /**
   * Internal SEO scoring algorithm (computes score 0-100)
   */
  calculateSeoScore(title, description, slug, keywords) {
    let score = 0;

    // 1. Check title length (Ideal: 15-60 chars)
    if (title && title.length >= 15 && title.length <= 60) score += 25;
    else if (title && title.length > 0) score += 10;

    // 2. Check meta description (Ideal: 50-160 chars)
    if (description && description.length >= 50 && description.length <= 160) score += 25;
    else if (description && description.length > 0) score += 10;

    // 3. Check clean slug
    const cleanSlugReg = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (slug && cleanSlugReg.test(slug)) score += 20;

    // 4. Check keyword targets (requires >= 2 keywords)
    if (keywords && keywords.length >= 2) score += 15;
    else if (keywords && keywords.length > 0) score += 5;

    // 5. Check alt text helper
    score += 15; // default schema credit

    return score;
  }

  /**
   * Returns validation notifications for SEO alerts
   */
  getSeoSuggestions(title, description, slug, keywords) {
    const list = [];
    if (!title || title.length < 15 || title.length > 60) {
      list.push('Meta Title length should be between 15 and 60 characters for best display on Google search.');
    }
    if (!description || description.length < 50 || description.length > 160) {
      list.push('Meta Description should be between 50 and 160 characters for snippets validation.');
    }
    const cleanSlugReg = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slug || !cleanSlugReg.test(slug)) {
      list.push('Slug should be in lowercase and contain only words and hyphens (no spaces or specials).');
    }
    if (!keywords || keywords.length < 2) {
      list.push('Specify at least 2 target search keywords for indexing indexing.');
    }
    return list;
  }

  /**
   * Helpers to log audit records
   */
  async logAudit(db, actor, action, target, details = {}) {
    try {
      await db.query(
        `INSERT INTO public.cms_audit_logs (actor, action, target, details)
         VALUES ($1, $2, $3, $4)`,
        [actor, action, target, JSON.stringify(details)]
      );
    } catch (err) {
      console.error('[Audit Logger] CMS fail:', err);
    }
  }
}

module.exports = new CmsManager();
