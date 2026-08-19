const { Client } = require('pg');
const paymentManager = require('./services/paymentManager');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function runTests() {
  console.log("=== STARTING ENTERPRISE PAYMENT ENGINE & BILLING TESTS ===");
  const db = new Client(dbConfig);
  await db.connect();

  try {
    // 1. Assert Coupon and GST Tax Calculations
    console.log("\n1. Testing checkout order creation with WELCOME50 coupon and India GST...");
    const order = await paymentManager.createOrder(db, {
      studentId: 'pay-test-student',
      planId: 'plan_premium_monthly',
      couponCode: 'WELCOME50',
      country: 'India'
    });

    console.log(`- Created Order: ${order.id}`);
    console.log(`- Base Plan Value: ₹599.00`);
    console.log(`- Calculated Discount: ₹${order.discount} (Expected: ₹299.50)`);
    console.log(`- Calculated Tax (GST 18%): ₹${order.tax} (Expected: ₹53.91)`);
    console.log(`- Calculated Total: ₹${order.amount} (Expected: ₹353.41)`);

    if (parseFloat(order.discount) !== 299.50) {
      throw new Error(`Discount calculation error: expected 299.50, got ${order.discount}`);
    }
    if (parseFloat(order.tax) !== 53.91) {
      throw new Error(`Tax calculation error: expected 53.91, got ${order.tax}`);
    }
    if (parseFloat(order.amount) !== 353.41) {
      throw new Error(`Total amount calculation error: expected 353.41, got ${order.amount}`);
    }
    console.log("✓ Coupon and GST Tax Calculations passed.");

    // 2. Assert Signature Verification & Subscription Activation
    console.log("\n2. Testing payment signature verification and subscription activation...");
    const verifyResult = await paymentManager.verifyPayment(db, {
      orderId: order.id,
      signature: 'test_signature_razorpay',
      gateway: 'razorpay',
      amount: order.amount,
      studentId: 'pay-test-student'
    });

    console.log(`- Payment Verification Status: ${verifyResult.orderStatus}`);
    console.log(`- Generated Invoice: ${verifyResult.invoice.invoice_number}`);
    console.log(`- Active Subscription ID: ${verifyResult.subscription.id}`);
    console.log(`- Subscription End: ${verifyResult.subscription.current_period_end}`);

    if (verifyResult.orderStatus !== 'Succeeded') {
      throw new Error("Order capture status is not Succeeded.");
    }
    if (verifyResult.subscription.status !== 'Active') {
      throw new Error("Subscription status is not Active.");
    }
    console.log("✓ Signature verification and subscription activation passed.");

    // 3. Assert Entitlement Gates
    console.log("\n3. Testing entitlement gates for premium access controls...");
    const hasUnlimitedMocks = await paymentManager.checkEntitlement(db, 'pay-test-student', 'unlimited_mocks');
    const hasAiTutor = await paymentManager.checkEntitlement(db, 'pay-test-student', 'ai_tutor');
    
    console.log(`- Has Unlimited Mock Tests: ${hasUnlimitedMocks ? 'YES' : 'NO'}`);
    console.log(`- Has Premium AI Tutor Access: ${hasAiTutor ? 'YES' : 'NO'}`);

    if (!hasUnlimitedMocks || !hasAiTutor) {
      throw new Error("Entitlement engine blocked premium access to authorized subscriber.");
    }
    console.log("✓ Entitlement gates verification passed.");

    // 4. Assert Wallet Payout Rewards
    console.log("\n4. Testing wallet referral and welcome rewards credit ledger...");
    const { rows: walletTx } = await db.query("SELECT * FROM public.wallet_transactions WHERE student_id = 'pay-test-student' ORDER BY timestamp DESC LIMIT 1");
    console.log(`- Wallet Transaction Record Found: ${walletTx[0] ? 'YES' : 'NO'}`);
    console.log(`- Credited Amount: ₹${walletTx[0] ? walletTx[0].amount : 0}`);

    if (walletTx.length === 0 || parseFloat(walletTx[0].amount) !== 50.00) {
      throw new Error("Wallet reward transaction was not credited correctly.");
    }
    console.log("✓ Wallet rewards checks passed.");

    // 5. Assert Refund Processing
    console.log("\n5. Testing admin refund payouts and subscription cancellation...");
    const refund = await paymentManager.proposeRefund(db, {
      orderId: order.id,
      amount: order.amount,
      reason: 'Sandbox E2E refund test'
    });

    console.log(`- Refund Status: ${refund.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`- Refunded Amount: ₹${refund.refundedAmount}`);

    const { rows: checkOrder } = await db.query("SELECT status FROM public.orders WHERE id = $1", [order.id]);
    const { rows: checkSub } = await db.query("SELECT status FROM public.subscriptions WHERE id = $1", [verifyResult.subscription.id]);

    console.log(`- Order Status Post-Refund: ${checkOrder[0].status}`);
    console.log(`- Subscription Status Post-Refund: ${checkSub[0].status}`);

    if (checkOrder[0].status !== 'Refunded') {
      throw new Error(`Expected order status 'Refunded', got '${checkOrder[0].status}'`);
    }
    if (checkSub[0].status !== 'Cancelled') {
      throw new Error(`Expected subscription status 'Cancelled', got '${checkSub[0].status}'`);
    }
    console.log("✓ Refund processing checks passed.");

    console.log("\n=== ALL PAYMENT AND SUBSCRIPTION ENGINE TESTS PASSED SUCCESSFULLY! ===");

  } catch (err) {
    console.error("\n❌ PAYMENT TEST FAILED:", err.message);
    process.exit(1);
  } finally {
    // Clean up our E2E test data
    console.log("\nCleaning up test logs...");
    await db.query("DELETE FROM public.wallet_transactions WHERE student_id = 'pay-test-student'");
    await db.query("DELETE FROM public.subscriptions WHERE student_id = 'pay-test-student'");
    await db.query("DELETE FROM public.invoices WHERE student_id = 'pay-test-student'");
    await db.query("DELETE FROM public.orders WHERE student_id = 'pay-test-student'");
    await db.query("DELETE FROM public.payment_audit_logs WHERE actor = 'pay-test-student' OR target LIKE 'ord_%'");
    await db.end();
  }
}

runTests();
