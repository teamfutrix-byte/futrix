const crypto = require('crypto');
const paymentManager = require('./paymentManager');

async function getScholarships(db) {
  const { rows } = await db.query("SELECT * FROM public.scholarships ORDER BY id ASC");
  return rows;
}

async function getPromotions(db) {
  const { rows } = await db.query("SELECT * FROM public.promotional_campaigns ORDER BY id ASC");
  return rows;
}

async function getReferrals(db) {
  const { rows } = await db.query("SELECT * FROM public.referrals ORDER BY created_at DESC");
  return rows;
}

async function createReferralLink(db, { referrerId }) {
  const code = 'REF-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const { rows } = await db.query(`
    INSERT INTO public.referrals (code, referrer_id, status)
    VALUES ($1, $2, 'Pending')
    RETURNING *
  `, [code, referrerId]);
  return rows[0];
}

async function trackReferralConversion(db, { referralCode, refereeId }) {
  const { rows: refRows } = await db.query("SELECT * FROM public.referrals WHERE code = $1", [referralCode]);
  if (refRows.length === 0) {
    throw new Error(`Referral code '${referralCode}' not found.`);
  }
  const referral = refRows[0];

  // Update referral conversion status
  const { rows } = await db.query(`
    UPDATE public.referrals 
    SET referee_id = $1, status = 'Paid' 
    WHERE code = $2
    RETURNING *
  `, [refereeId, referralCode]);

  // Credit Referrer wallet
  await db.query(`
    INSERT INTO public.wallet_transactions (student_id, amount, type, description, correlation_id)
    VALUES ($1, $2, 'credit', $3, $4)
  `, [referral.referrer_id, referral.reward_credits, `Referral reward bonus conversion for code: ${referralCode}`, referralCode]);

  // Credit Referee welcome wallet credit
  await db.query(`
    INSERT INTO public.wallet_transactions (student_id, amount, type, description, correlation_id)
    VALUES ($1, 10.00, 'credit', 'Welcome bonus referral credit', $2)
  `, [refereeId, referralCode]);

  return rows[0];
}

async function checkUsageLimit(db, { studentId, actionKey }) {
  // 1. Fetch Plan limits
  const { rows: subRows } = await db.query(`
    SELECT plan_id FROM public.subscriptions 
    WHERE student_id = $1 AND status = 'Active' AND current_period_end > NOW()
    ORDER BY current_period_end DESC LIMIT 1
  `, [studentId]);

  let planId = 'plan_free_trial';
  if (subRows.length > 0) {
    planId = subRows[0].plan_id;
  }

  const { rows: planRows } = await db.query("SELECT * FROM public.plans WHERE id = $1", [planId]);
  const plan = planRows[0] || { ai_credits: 5, mock_tests: 2 };

  const limitAi = plan.id === 'plan_free_trial' ? 5 : 500;
  const limitMock = plan.id === 'plan_free_trial' ? 2 : 9999;

  // 2. Fetch today's usage row
  const today = new Date().toISOString().split('T')[0];
  const { rows: usageRows } = await db.query(`
    SELECT * FROM public.student_usage_limits 
    WHERE student_id = $1 AND date = $2
  `, [studentId, today]);

  let usage = usageRows[0];
  if (!usage) {
    const { rows: insertRows } = await db.query(`
      INSERT INTO public.student_usage_limits (student_id, date, ai_completions_count, mock_tests_count)
      VALUES ($1, $2, 0, 0)
      RETURNING *
    `, [studentId, today]);
    usage = insertRows[0];
  }

  // 3. Enforce and Increment limits
  if (actionKey === 'ai_completion') {
    if (usage.ai_completions_count >= limitAi) {
      return { allowed: false, current: usage.ai_completions_count, limit: limitAi };
    }
    const { rows: updatedRows } = await db.query(`
      UPDATE public.student_usage_limits 
      SET ai_completions_count = ai_completions_count + 1
      WHERE student_id = $1 AND date = $2
      RETURNING *
    `, [studentId, today]);
    return { allowed: true, current: updatedRows[0].ai_completions_count, limit: limitAi };
  }

  if (actionKey === 'mock_test') {
    if (usage.mock_tests_count >= limitMock) {
      return { allowed: false, current: usage.mock_tests_count, limit: limitMock };
    }
    const { rows: updatedRows } = await db.query(`
      UPDATE public.student_usage_limits 
      SET mock_tests_count = mock_tests_count + 1
      WHERE student_id = $1 AND date = $2
      RETURNING *
    `, [studentId, today]);
    return { allowed: true, current: updatedRows[0].mock_tests_count, limit: limitMock };
  }

  return { allowed: false, current: 0, limit: 0 };
}

async function proposeUpgrade(db, { studentId, newPlanId }) {
  // Fetch new plan price
  const { rows: planRows } = await db.query("SELECT * FROM public.plans WHERE id = $1", [newPlanId]);
  if (planRows.length === 0) {
    throw new Error(`Plan ID '${newPlanId}' not found.`);
  }
  const newPlan = planRows[0];

  // Fetch active subscription
  const { rows: subRows } = await db.query(`
    SELECT * FROM public.subscriptions 
    WHERE student_id = $1 AND status = 'Active' AND current_period_end > NOW()
    ORDER BY current_period_end DESC LIMIT 1
  `, [studentId]);

  if (subRows.length === 0) {
    return {
      originalPrice: parseFloat(newPlan.price),
      proratedDiscount: 0.00,
      finalPrice: parseFloat(newPlan.price)
    };
  }

  const sub = subRows[0];
  const { rows: oldPlanRows } = await db.query("SELECT * FROM public.plans WHERE id = $1", [sub.plan_id]);
  const oldPlan = oldPlanRows[0];

  const now = new Date();
  const periodStart = new Date(sub.current_period_start);
  const periodEnd = new Date(sub.current_period_end);

  const totalDuration = periodEnd.getTime() - periodStart.getTime();
  const remainingDuration = periodEnd.getTime() - now.getTime();

  let proratedDiscount = 0.00;
  if (totalDuration > 0 && remainingDuration > 0) {
    const fraction = remainingDuration / totalDuration;
    proratedDiscount = parseFloat((fraction * oldPlan.price).toFixed(2));
  }

  const finalPrice = parseFloat(Math.max(0.00, newPlan.price - proratedDiscount).toFixed(2));

  return {
    originalPrice: parseFloat(newPlan.price),
    proratedDiscount,
    finalPrice
  };
}

async function giftSubscription(db, { senderId, receiverId, planId }) {
  // 1. Fetch Plan details
  const { rows: planRows } = await db.query("SELECT * FROM public.plans WHERE id = $1", [planId]);
  if (planRows.length === 0) {
    throw new Error(`Plan ID '${planId}' not found.`);
  }
  const plan = planRows[0];

  // 2. Create order for Receiver
  const orderId = 'ord_' + crypto.randomBytes(8).toString('hex');
  const planPrice = parseFloat(plan.price);
  const tax = parseFloat((planPrice * 0.18).toFixed(2));
  const total = parseFloat((planPrice + tax).toFixed(2));

  await db.query(`
    INSERT INTO public.orders (id, student_id, plan_id, amount, discount, tax, currency, gateway, status)
    VALUES ($1, $2, $3, $4, 0.00, $5, $6, 'stripe', 'Succeeded')
  `, [orderId, receiverId, planId, total, tax, plan.currency]);

  // 3. Subscription Engine Activation for Receiver
  const subId = 'sub_' + crypto.randomBytes(8).toString('hex');
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + plan.billing_cycle_months);

  const { rows: subRows } = await db.query(`
    INSERT INTO public.subscriptions (id, student_id, plan_id, status, current_period_start, current_period_end)
    VALUES ($1, $2, $3, 'Active', NOW(), $4)
    RETURNING *
  `, [subId, receiverId, planId, periodEnd]);

  // Link sub back to receiver's order
  await db.query("UPDATE public.orders SET subscription_id = $1 WHERE id = $2", [subId, orderId]);

  // 4. Log Audit trail for Gifter/Sender
  await db.query(`
    INSERT INTO public.payment_audit_logs (actor, action, target, amount, result)
    VALUES ($1, 'GIFT_PAYMENT', $2, $3, 'SUCCESS')
  `, [senderId, receiverId, total]);

  return {
    success: true,
    receiverId,
    subscription: subRows[0]
  };
}

module.exports = {
  getScholarships,
  getPromotions,
  getReferrals,
  createReferralLink,
  trackReferralConversion,
  checkUsageLimit,
  proposeUpgrade,
  giftSubscription
};
