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
    const res = await fetchUrl('https://api.github.com/repos/teamfutrix-byte/futrix/contents');
    const files = JSON.parse(res.data);
    console.log('Files at root:');
    files.forEach(f => console.log(`- ${f.name} (${f.type})`));
  } catch (err) {
    console.error(err);
  }
}

run();
