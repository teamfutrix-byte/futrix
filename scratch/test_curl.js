async function check() {
  try {
    const res = await fetch('https://dsduytkikxfgiyptdwex.supabase.co/rest/v1/exam_categories', {
      headers: {
        'apikey': 'sb_publishable_2JjhenlD2BmOyojrNwIb4w_yO60inNc',
        'Authorization': 'Bearer sb_publishable_2JjhenlD2BmOyojrNwIb4w_yO60inNc'
      }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Data:', data);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

check();
