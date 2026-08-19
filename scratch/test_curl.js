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
    const res = await fetchUrl('https://teamfutrix-byte.github.io/futrix/features/auth/login.html?t=' + Date.now());
    console.log('Status Code:', res.statusCode);
    const startIdx = res.data.indexOf('Request Access');
    if (startIdx !== -1) {
      console.log('HTML around Request Access:');
      console.log(res.data.substring(startIdx - 100, startIdx + 100));
    } else {
      console.log('Request Access text not found!');
    }
  } catch (err) {
    console.error(err);
  }
}

run();
