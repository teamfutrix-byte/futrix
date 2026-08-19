const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data: data.substring(0, 1000) }));
    }).on('error', reject);
  });
}

async function run() {
  try {
    console.log('Fetching student index...');
    const indexRes = await fetchUrl('https://teamfutrix-byte.github.io/futrix/features/student/index.html');
    console.log('Index Status:', indexRes.statusCode);

    console.log('Fetching student login...');
    const loginRes = await fetchUrl('https://teamfutrix-byte.github.io/futrix/features/auth/login.html');
    console.log('Login Status:', loginRes.statusCode);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();
