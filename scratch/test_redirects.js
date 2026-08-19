const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
    }).on('error', reject);
  });
}

async function run() {
  try {
    console.log('Fetching live index.html...');
    const res = await fetchUrl('https://teamfutrix-byte.github.io/futrix/features/student/index.html?t=' + Date.now());
    console.log('Status Code:', res.statusCode);
    
    // Check for correct relative path redirection
    const hasCorrectStartTestLink = res.data.includes('href="../../features/tests/active-exams.html"');
    console.log('Contains correct relative Start Test Link:', hasCorrectStartTestLink);
    
    const hasCorrectLoginLink = res.data.includes('href="../../features/auth/login.html"');
    console.log('Contains correct relative Login Competitor Link:', hasCorrectLoginLink);

    if (!hasCorrectStartTestLink || !hasCorrectLoginLink) {
      console.log('WARNING: Some links are not correctly resolved relative to the page depth!');
      console.log('Sample data near links:');
      const startIdx = res.data.indexOf('active-exams.html');
      if (startIdx !== -1) {
        console.log(res.data.substring(startIdx - 100, startIdx + 200));
      }
    } else {
      console.log('All links verified successfully on the live site! ✅');
    }
  } catch (err) {
    console.error('Validation error:', err);
  }
}

run();
