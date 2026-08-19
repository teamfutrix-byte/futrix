const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://dsduytkikxfgiyptdwex.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2JjhenlD2BmOyojrNwIb4w_yO60inNc';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const email = 'testcandidate_1782984658152@gmail.com';
  console.log(`Querying profiles for email: ${email}`);
  const { data, error } = await supabase
    .from('profiles')
    .select('otp_code')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  console.log("Result:", data);
  console.log("Error:", error);
}

main();
