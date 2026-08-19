const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dsduytkikxfgiyptdwex.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2JjhenlD2BmOyojrNwIb4w_yO60inNc';

// We will use the service role key or just the anon key?
// Let's use the anon key first since the browser uses the anon key.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const userId = '78a4bba8-4501-44ae-bdf5-96955fa26d9c'; // User ID of testcandidate3
  
  // We need to sign in first to get an authenticated session!
  console.log("Signing in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcandidate3@gmail.com',
    password: '9988776655'
  });

  if (authError) {
    console.error("Sign in failed:", authError);
    return;
  }

  console.log("Sign in succeeded. User ID:", authData.user.id);

  // 1. Check institutes table
  console.log("Step 1: Checking institutes table...");
  const { data: inst, error: instError } = await supabase
    .from('institutes')
    .select('id')
    .eq('name', 'Futrix Institute')
    .maybeSingle();
  
  if (instError) {
    console.error("[✗] Institutes select failed:", instError);
  } else {
    console.log("[✓] Institutes select succeeded:", inst);
  }

  // Try insert institute if not exists
  let instituteId = inst ? inst.id : null;
  if (!instituteId) {
    console.log("Inserting new institute...");
    const { data: newInst, error: newInstErr } = await supabase
      .from('institutes')
      .insert({ name: 'Futrix Institute' })
      .select('id')
      .maybeSingle();
    
    if (newInstErr) {
      console.error("[✗] Institutes insert failed:", newInstErr);
    } else {
      console.log("[✓] Institutes insert succeeded:", newInst);
      if (newInst) instituteId = newInst.id;
    }
  }

  // 2. Check profiles table select
  console.log("Step 2: Checking profiles table select...");
  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profError) {
    console.error("[✗] Profiles select failed:", profError);
  } else {
    console.log("[✓] Profiles select succeeded:", profile);
  }

  // 3. Try profile insert or update
  console.log("Step 3: Checking profiles table insert/update...");
  const profileData = {
    id: userId,
    full_name: 'Test Candidate',
    email: 'testcandidate3@gmail.com',
    phone: '9988776655',
    dob: '2000-01-01',
    guardian_name: 'Sunil Kumar',
    guardian_contact: '9988776654',
    city: 'Delhi',
    qualification: '12th Pass',
    institute_id: instituteId,
    pin_code: '110001',
    preparation_for: 'NEET',
    role: 'student',
    xp_balance: 100.00
  };

  const { error: profInsertError } = await supabase
    .from('profiles')
    .upsert(profileData);

  if (profInsertError) {
    console.error("[✗] Profiles upsert failed:", profInsertError);
  } else {
    console.log("[✓] Profiles upsert succeeded.");
  }

  // 4. Try xp_transactions insert
  console.log("Step 4: Checking xp_transactions table insert...");
  const { error: txError } = await supabase.from('xp_transactions').insert({
    user_id: userId,
    amount: 100.00,
    transaction_type: 'registration'
  });

  if (txError) {
    console.error("[✗] xp_transactions insert failed:", txError);
  } else {
    console.log("[✓] xp_transactions insert succeeded.");
  }

  // 5. Try audit_logs insert
  console.log("Step 5: Checking audit_logs table insert...");
  const { error: logError } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'Registration',
    details: { email: 'testcandidate3@gmail.com', fullName: 'Test Candidate' },
    ip_address: 'client'
  });

  if (logError) {
    console.error("[✗] audit_logs insert failed:", logError);
  } else {
    console.log("[✓] audit_logs insert succeeded.");
  }
}

main();
