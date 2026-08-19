async function checkUrl() {
  const url = 'http://localhost:8080/supabase-js.js';
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get('content-type'));
    const text = await res.text();
    console.log("Length:", text.length);
    console.log("Snippet:", text.substring(0, 100));
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

checkUrl();
