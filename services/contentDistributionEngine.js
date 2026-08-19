/**
 * Enterprise Content Distribution Engine (CDE) Service
 * AI-powered routing, multi-channel publishing, scheduling, and delivery analytics.
 */
const aiGateway = require('./aiGateway');

class ContentDistributionEngine {

  /**
   * Publishes content to a delivery channel, verifying mapping and scheduling triggers
   */
  async publishContentToChannel(db, contentType, contentId, channelName, scheduleData) {
    // 1. Upsert Content Distribution status
    await db.query(`
      INSERT INTO public.content_distribution (content_type, content_id, status)
      VALUES ($1, $2, 'Distributed')
      ON CONFLICT (content_type, content_id) DO UPDATE
      SET status = 'Distributed', updated_at = now()
    `, [contentType, contentId]);

    // 2. Insert into Channel Mapping (Ensuring multi-channel delivery without duplication)
    const { rows: mapRows } = await db.query(`
      INSERT INTO public.channel_mapping (content_type, content_id, channel_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (content_type, content_id, channel_name) DO UPDATE
      SET is_active = true
      RETURNING *
    `, [contentType, contentId, channelName]);

    // 3. Register in schedule list if schedule dates are provided
    if (scheduleData && scheduleData.publishAt) {
      await db.query(`
        INSERT INTO public.distribution_schedule (content_type, content_id, channel_name, publish_at, expire_at, status)
        VALUES ($1, $2, $3, $4, $5, 'Scheduled')
      `, [contentType, contentId, channelName, scheduleData.publishAt, scheduleData.expireAt || null]);
    }

    // Increment reach in analytics
    await db.query(`
      INSERT INTO public.distribution_analytics (channel_name, content_reach)
      VALUES ($1, 1)
      ON CONFLICT (channel_name, recorded_date) DO UPDATE
      SET content_reach = public.distribution_analytics.content_reach + 1
    `, [channelName]).catch(() => {});

    return mapRows[0];
  }

  /**
   * Executes AI routing evaluation and target module mapping
   */
  async routeContentWithAI(db, contentType, contentId, requesterId) {
    let recommendedChannel = 'Practice Mode';
    let reasoning = 'Standard baseline practice routing';
    let confidenceScore = 80.00;
    let priority = 2;

    // Call AI gateway if available, or fall back to structured heuristics
    try {
      const prompt = `Perform distribution routing check for resource: Type: ${contentType}, ID: ${contentId}. Recommend best delivery channel (e.g. Daily Test, Memory Lab, Challenge Mode). Return JSON: {"channel": "Challenge Mode", "reason": "High complexity formula question ideal for challenges", "confidence": 95, "priority": 3}`;
      const result = await aiGateway.executeComplete(db, 'mentor_chat', requesterId, { query: prompt });
      if (result && result.response) {
        const jsonMatch = result.response.match(/\{[^}]+\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          recommendedChannel = parsed.channel || recommendedChannel;
          reasoning = parsed.reason || reasoning;
          confidenceScore = parseFloat(parsed.confidence || confidenceScore);
          priority = parseInt(parsed.priority || priority);
        }
      }
    } catch (_) {}

    // 1. Record in routing history
    await db.query(`
      INSERT INTO public.routing_history (content_type, content_id, assigned_channel, routed_by, routing_reason, ai_confidence_score)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [contentType, contentId, recommendedChannel, requesterId, reasoning, confidenceScore]);

    // 2. Record in content_recommendation_engine suggestions
    const { rows: recRows } = await db.query(`
      INSERT INTO public.content_recommendation_engine (content_type, content_id, recommended_channel, reasoning, confidence_score, priority)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [contentType, contentId, recommendedChannel, reasoning, confidenceScore, priority]);

    // 3. Update distribution status
    await db.query(`
      INSERT INTO public.content_distribution (content_type, content_id, status, priority)
      VALUES ($1, $2, 'Routed', $3)
      ON CONFLICT (content_type, content_id) DO UPDATE
      SET status = 'Routed', priority = $3, updated_at = now()
    `, [contentType, contentId, priority]);

    return recRows[0];
  }

  /**
   * Bulk asynchronous routing and channel dispatching matching filters
   */
  async bulkRouteAndPublish(db, filters, channelNames, scheduleData) {
    const { subject, chapter, topic } = filters;

    // Query questions matching filters
    let query = "SELECT id FROM public.questions WHERE 1=1";
    const params = [];
    let paramIdx = 1;

    if (subject) {
      query += ` AND subject = $${paramIdx++}`;
      params.push(subject);
    }
    if (chapter) {
      query += ` AND chapter = $${paramIdx++}`;
      params.push(chapter);
    }
    if (topic) {
      query += ` AND topic = $${paramIdx++}`;
      params.push(topic);
    }

    query += " LIMIT 100";

    const { rows: questions } = await db.query(query, params);

    let processed = 0;
    for (const q of questions) {
      for (const channel of channelNames) {
        await this.publishContentToChannel(db, 'Question', q.id, channel, scheduleData);
      }
      processed++;
    }

    return { processedCount: processed, channelsTargeted: channelNames };
  }

  /**
   * Automatically evaluates promotion rules triggers (e.g. moves high-quality free content to Premium)
   */
  async checkPromotionEligibility(db, contentType, contentId) {
    let qualifies = false;
    let recommendedAction = 'None';
    let triggerMetric = 'None';
    let value = 0.0;

    // Check if item has high quality score in public.question_quality
    if (contentType === 'Question') {
      const { rows: qualityRows } = await db.query(
        "SELECT overall_quality_score FROM public.question_quality WHERE question_id = $1 LIMIT 1",
        [contentId]
      );
      if (qualityRows.length > 0) {
        value = parseFloat(qualityRows[0].overall_quality_score || 0);
        triggerMetric = 'Quality Score';
        
        // Fetch promotion thresholds from DB
        const { rows: rules } = await db.query(
          "SELECT * FROM public.promotion_rules WHERE trigger_metric = 'Quality Score' AND is_active = true LIMIT 1"
        );
        if (rules.length > 0 && value >= parseFloat(rules[0].threshold_value)) {
          qualifies = true;
          recommendedAction = rules[0].action_type;
        }
      }
    }

    return { contentId, contentType, qualifies, triggerMetric, value, recommendedAction };
  }

  /**
   * Tracks student engagement metrics on delivery channels
   */
  async recordDistributionEngagement(db, channelName, metricType) {
    let updateField = 'student_engagement';
    if (metricType === 'Click') updateField = 'click_rate_pct';
    else if (metricType === 'Attempt') updateField = 'attempt_rate_pct';
    else if (metricType === 'Completion') updateField = 'completion_rate_pct';

    if (updateField === 'student_engagement') {
      await db.query(`
        INSERT INTO public.distribution_analytics (channel_name, student_engagement)
        VALUES ($1, 1)
        ON CONFLICT (channel_name, recorded_date) DO UPDATE
        SET student_engagement = public.distribution_analytics.student_engagement + 1
      `, [channelName]);
    } else {
      await db.query(`
        INSERT INTO public.distribution_analytics (channel_name, ${updateField})
        VALUES ($1, 1.00)
        ON CONFLICT (channel_name, recorded_date) DO UPDATE
        SET ${updateField} = LEAST(100.00, public.distribution_analytics.${updateField} + 1.00)
      `, [channelName]);
    }

    return { channelName, metricType, fieldUpdated: updateField };
  }

  /**
   * Compiles daily reach and performance success analytics
   */
  async getDistributionAnalytics(db) {
    const { rows: summary } = await db.query(`
      SELECT 
        channel_name,
        SUM(content_reach) as total_reach,
        SUM(student_engagement) as total_engagement,
        AVG(click_rate_pct)::numeric(5,2) as avg_click_rate,
        AVG(attempt_rate_pct)::numeric(5,2) as avg_attempt_rate
      FROM public.distribution_analytics
      GROUP BY channel_name
    `);

    return summary;
  }
}

module.exports = new ContentDistributionEngine();
