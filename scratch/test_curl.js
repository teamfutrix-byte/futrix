async function check() {
  try {
    const url = 'https://futrix-backend-7ly8.onrender.com/api/ai/test-series/NEET-CELL-DIV/questions';
    console.log('Fetching:', url);
    const res = await fetch(url);
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

check();
