const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dsduytkikxfgiyptdwex.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2JjhenlD2BmOyojrNwIb4w_yO60inNc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const email = `testcandidate_debug_${Date.now()}@gmail.com`;
  const password = '9988776655';
  
  console.log(`Attempting to sign up user: ${email} with password: ${password}`);

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: 'Test Candidate',
          phone: password
        }
      }
    });

    if (error) {
      console.error("Sign up failed! Error details:", error);
    } else {
      console.log("Sign up succeeded! Data:", data);
    }
  } catch (e) {
    console.error("Thrown exception during sign up:", e);
  }
}

main();
