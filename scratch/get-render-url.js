const fs = require('fs');
const path = require('path');
const https = require('https');

// Load env credentials
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  });
}

const RENDER_API_KEY = process.env.RENDER_API_KEY;

function makeRequest({ method, hostname, path, headers }) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method,
      hostname,
      path,
      headers: {
        'User-Agent': 'Futrix-Check-Agent',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const owners = await makeRequest({
    method: 'GET',
    hostname: 'api.render.com',
    path: '/v1/owners',
    headers: { 'Authorization': `Bearer ${RENDER_API_KEY}` }
  });

  const ownerId = owners[0].owner.id;

  const services = await makeRequest({
    method: 'GET',
    hostname: 'api.render.com',
    path: `/v1/services?ownerId=${ownerId}`,
    headers: { 'Authorization': `Bearer ${RENDER_API_KEY}` }
  });

  console.log("RENDER SERVICES LIST:");
  services.forEach(s => {
    console.log(`- Name: ${s.service.name}`);
    console.log(`  ID: ${s.service.id}`);
    console.log(`  URL: ${s.service.url}`);
    console.log(`  Deploy Status: ${s.service.suspended === 'suspended' ? 'Suspended' : 'Active'}`);
    console.log(`  Details:`, JSON.stringify(s.service.serviceDetails));
  });
}

run();
