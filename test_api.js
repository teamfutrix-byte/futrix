async function run() {
  const res = await fetch('http://localhost:8000/api/tests/generate', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer mock-admin-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      exam: 'NEET',
      subject: 'Physics',
      chapter: 'Mitosis Cell Cycle Validation',
      difficulty: 'Medium',
      type: 'MCQ',
      count: 25,
      duration: 30,
      negative: 'yes',
      blueprint: 'standard'
    })
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response:', data);
}

run().catch(console.error);
