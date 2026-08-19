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
    console.log('Fetching raw GitHub index.html...');
    const res = await fetchUrl('https://raw.githubusercontent.com/teamfutrix-byte/futrix/main/features/student/index.html');
    console.log('Status:', res.statusCode);
    const hasCorrectStartLink = res.data.includes('href="../../features/tests/active-exams.html"');
    console.log('GitHub Main Branch has correct Start Test Link:', hasCorrectStartLink);
    
    if (!hasCorrectStartLink) {
      console.log('Sample content near link:');
      const startIdx = res.data.indexOf('active-exams.html');
      if (startIdx !== -1) {
        console.log(res.data.substring(startIdx - 100, startIdx + 200));
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
