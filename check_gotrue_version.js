async function checkHealth() {
  const url = 'https://dsduytkikxfgiyptdwex.supabase.co/auth/v1/health';
  const SUPABASE_ANON_KEY = 'sb_publishable_2JjhenlD2BmOyojrNwIb4w_yO60inNc';
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY
      }
    });
    const data = await res.json();
    console.log("GoTrue Health status:", res.status);
    console.log("GoTrue Metadata:", data);
  } catch (err) {
    console.error("Error fetching health:", err.message);
  }
}

checkHealth();
