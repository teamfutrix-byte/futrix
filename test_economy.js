const { Client } = require('pg');
const economyManager = require('./services/economyManager');
const paymentManager = require('./services/paymentManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE DIGITAL ECONOMY & COMPLIANCE TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  try {
    // 1. Assert Daily AI Usage Limits
    console.log("\n1. Testing daily AI usage limits checks (Trial plan)...");
    
    // Clear any previous limit logs for test student
    const today = new Date().toISOString().split('T')[0];
    await db.query("DELETE FROM public.student_usage_limits WHERE student_id = 'econ-test-student'");
    await db.query("DELETE FROM public.subscriptions WHERE student_id = 'econ-test-student'");

    // By default, no active subscription means user is treated as plan_free_trial (Limit: 5 AI queries daily)
    console.log("- Running 5 successful AI completion queries...");
    for (let i = 1; i <= 5; i++) {
      const res = await economyManager.checkUsageLimit(db, { studentId: 'econ-test-student', actionKey: 'ai_completion' });
      console.log(`  * Query ${i}: Allowed = ${res.allowed} | Current: ${res.current}/${res.limit}`);
      if (!res.allowed) throw new Error(`Query ${i} was blocked unexpectedly.`);
    }

    console.log("- Running 6th query (should be blocked by limit engine)...");
    const resBlocked = await economyManager.checkUsageLimit(db, { studentId: 'econ-test-student', actionKey: 'ai_completion' });
    console.log(`  * Query 6: Allowed = ${resBlocked.allowed} | Current: ${resBlocked.current}/${resBlocked.limit}`);
    if (resBlocked.allowed) {
      throw new Error("Usage limit engine failed to block 6th query on free trial.");
    }
    console.log("✓ Daily AI usage limit enforcement passed.");

    // 2. Assert Referral Conversion & Wallet Credit
    console.log("\n2. Testing referral link campaign conversion and wallet payouts...");
    const referrer = 'econ-test-referrer';
    const referee = 'econ-test-referee';
    
    await db.query("DELETE FROM public.wallet_transactions WHERE student_id IN ($1, $2)", [referrer, referee]);
    await db.query("DELETE FROM public.referrals WHERE referrer_id = $1", [referrer]);

    // Create referral link
    const referral = await economyManager.createReferralLink(db, { referrerId: referrer });
    console.log(`- Created Referral Code: ${referral.code} | Referrer: ${referral.referrer_id}`);

    // Convert referee
    console.log("- Processing referee registration conversion...");
    const converted = await economyManager.trackReferralConversion(db, { referralCode: referral.code, refereeId: referee });
    console.log(`- Referral Status: ${converted.status} | Referee: ${converted.referee_id}`);

    if (converted.status !== 'Paid' || converted.referee_id !== referee) {
      throw new Error("Referral conversion did not complete successfully.");
    }

    // Verify wallet credits
    const { rows: referrerTx } = await db.query("SELECT * FROM public.wallet_transactions WHERE student_id = $1", [referrer]);
    const { rows: refereeTx } = await db.query("SELECT * FROM public.wallet_transactions WHERE student_id = $1", [referee]);
    
    console.log(`- Referrer wallet credited: ₹${referrerTx[0] ? referrerTx[0].amount : 0} (Expected: ₹50.00)`);
    console.log(`- Referee wallet credited: ₹${refereeTx[0] ? refereeTx[0].amount : 0} (Expected: ₹10.00)`);

    if (referrerTx.length === 0 || parseFloat(referrerTx[0].amount) !== 50.00) {
      throw new Error("Referrer wallet rewards not credited correctly.");
    }
    if (refereeTx.length === 0 || parseFloat(refereeTx[0].amount) !== 10.00) {
      throw new Error("Referee welcome reward not credited correctly.");
    }
    console.log("✓ Referral conversion rewards checks passed.");

    // 3. Assert Prorated Upgrades Credits
    console.log("\n3. Testing prorated subscription upgrade discount calculations...");
    // Clear previous
    await db.query("DELETE FROM public.subscriptions WHERE student_id = 'econ-test-student'");
    await db.query("DELETE FROM public.orders WHERE student_id = 'econ-test-student'");

    // Create a mock active monthly subscription
    console.log("- Mocking active monthly subscription...");
    const subId = 'sub_active_monthly';
    const now = new Date();
    const periodStart = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    await db.query(`
      INSERT INTO public.subscriptions (id, student_id, plan_id, status, current_period_start, current_period_end)
      VALUES ($1, 'econ-test-student', 'plan_premium_monthly', 'Active', $2, $3)
    `, [subId, periodStart, periodEnd]);

    // Estimate upgrade to annual
    const upgrade = await economyManager.proposeUpgrade(db, { studentId: 'econ-test-student', newPlanId: 'plan_premium_annual' });
    console.log(`- Target Annual Price: ₹${upgrade.originalPrice}`);
    console.log(`- Prorated Discount Calculated: ₹${upgrade.proratedDiscount} (Expected: ~₹299.50)`);
    console.log(`- Net Upgrade Price Due: ₹${upgrade.finalPrice} (Expected: ~₹4699.50)`);

    // Pro-rata discount for 15 days remaining of ₹599.00 plan should be around 299.50
    if (upgrade.proratedDiscount < 280.00 || upgrade.proratedDiscount > 310.00) {
      throw new Error(`Prorated discount error: calculated ${upgrade.proratedDiscount}`);
    }
    console.log("✓ Prorated upgrade checks passed.");

    // 4. Assert Gift Subscriptions Sponsor
    console.log("\n4. Testing gift subscription sponsor authorization...");
    const sender = 'econ-test-sender';
    const recipient = 'econ-test-recipient';
    
    await db.query("DELETE FROM public.subscriptions WHERE student_id = $1", [recipient]);
    await db.query("DELETE FROM public.orders WHERE student_id = $1", [recipient]);
    await db.query("DELETE FROM public.payment_audit_logs WHERE actor = $1", [sender]);

    console.log("- Sponsoring Premium Monthly Plan to recipient...");
    const gift = await economyManager.giftSubscription(db, {
      senderId: sender,
      receiverId: recipient,
      planId: 'plan_premium_monthly'
    });

    console.log(`- Gift Success: ${gift.success} | Receiver: ${gift.receiverId}`);
    console.log(`- Active Subscription ID: ${gift.subscription.id} | Status: ${gift.subscription.status}`);

    if (!gift.success || gift.subscription.status !== 'Active') {
      throw new Error("Gift subscription was not activated on receiver profile.");
    }

    // Verify gift audit trail
    const { rows: auditCheck } = await db.query("SELECT * FROM public.payment_audit_logs WHERE actor = $1 AND action = 'GIFT_PAYMENT'", [sender]);
    console.log(`- Gift audit logged: ${auditCheck[0] ? 'YES' : 'NO'}`);
    if (auditCheck.length === 0) throw new Error("Gift payment was not audited.");
    console.log("✓ Gift subscription checks passed.");

    console.log("\n=== ALL DIGITAL ECONOMY & COMPLIANCE POLICY TESTS PASSED! ===");
  } catch (err) {
    console.error("\n❌ ECONOMY TEST FAILED:", err.stack);
    process.exit(1);
  } finally {
    // Clean up E2E test data
    console.log("\nCleaning up test logs...");
    await db.query("DELETE FROM public.wallet_transactions WHERE student_id IN ('econ-test-referrer', 'econ-test-referee')");
    await db.query("DELETE FROM public.referrals WHERE referrer_id = 'econ-test-referrer'");
    await db.query("DELETE FROM public.subscriptions WHERE student_id IN ('econ-test-student', 'econ-test-recipient')");
    await db.query("DELETE FROM public.orders WHERE student_id = 'econ-test-recipient'");
    await db.query("DELETE FROM public.student_usage_limits WHERE student_id = 'econ-test-student'");
    await db.query("DELETE FROM public.payment_audit_logs WHERE actor = 'econ-test-sender'");
    await db.end();
  }
}

runTests();
