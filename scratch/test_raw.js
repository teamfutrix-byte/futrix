const https = require('https');

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  try {
    console.log('Sending post to Render server backend send-otp...');
    const res = await postJson('https://futrix-backend-7ly8.onrender.com/api/auth/send-otp', {
      email: 'teamfutrix@gmail.com',
      role: 'student',
      full_name: 'Team Futrix'
    });
    console.log('Status Code:', res.statusCode);
    console.log('Response:', res.data);
  } catch (err) {
    console.error(err);
  }
}

run();
