const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'NodeJS' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function run() {
  try {
    const res = await fetchUrl('https://raw.githubusercontent.com/teamfutrix-byte/futrix/main/features/student/index.html?t=' + Date.now());
    const lines = res.data.split('\n');
    console.log('Total Lines:', lines.length);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('active-exams.html')) {
        console.log(`Line ${i + 1}: ${lines[i].trim()}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
