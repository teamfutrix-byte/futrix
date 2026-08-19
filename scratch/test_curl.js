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
    const res = await fetchUrl('https://teamfutrix-byte.github.io/futrix/features/student/index.html?t=' + Date.now());
    console.log('Live GitHub Pages Status Code:', res.statusCode);
    const startIdx = res.data.indexOf('Login Competitor');
    if (startIdx !== -1) {
      console.log('HTML around Login Competitor:');
      console.log(res.data.substring(startIdx - 100, startIdx + 100));
    } else {
      console.log('Login Competitor text not found!');
    }
  } catch (err) {
    console.error(err);
  }
}

run();
