async function checkPort() {
  const url = 'http://127.0.0.1:9222/json/version';
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      console.log("[✓] Chrome Remote Debugging is ACTIVE!");
      console.log("Details:", data);
    } else {
      console.log("[✗] Port 9222 responded, but failed to fetch version:", res.status);
    }
  } catch (err) {
    console.log("[✗] Chrome Remote Debugging is NOT active on port 9222:", err.message);
  }
}

checkPort();
