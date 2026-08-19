const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Load env credentials natively
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

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const RENDER_API_KEY = process.env.RENDER_API_KEY;

if (!GITHUB_TOKEN || !GITHUB_USERNAME || !RENDER_API_KEY) {
  console.error("❌ Missing environment credentials.");
  process.exit(1);
}

function makeRequest({ method, hostname, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method,
      hostname,
      path,
      headers: {
        'User-Agent': 'Futrix-Rename-Agent',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', err => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log("=== RENAME AND RE-DEPLOY PIPELINE STARTED ===");

  // 1. Rename host-code-web-app repository to "futrix"
  console.log("- Checking if 'host-code-web-app' repository exists to rename...");
  const renameRes = await makeRequest({
    method: 'PATCH',
    hostname: 'api.github.com',
    path: `/repos/${GITHUB_USERNAME}/host-code-web-app`,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: {
      name: 'futrix'
    }
  });

  if (renameRes.status === 200) {
    console.log("✓ GitHub repository renamed to 'futrix' successfully.");
  } else {
    console.log(`ℹ Repository 'host-code-web-app' rename status: ${renameRes.status}. (Might be already renamed)`);
  }

  // 2. Wipe and recreate git inside `/host` to point to the new remote repository "futrix"
  const hostDir = path.join(__dirname, '..', 'host');
  const gitPath = path.join(hostDir, '.git');
  if (fs.existsSync(gitPath)) {
    fs.rmSync(gitPath, { recursive: true, force: true });
  }

  console.log("\n- Initializing new Git remote pointing to 'futrix'...");
  execSync('git init', { cwd: hostDir });
  execSync('git config user.email "deploy-agent@futrix.io"', { cwd: hostDir });
  execSync('git config user.name "Futrix Deployer"', { cwd: hostDir });
  execSync('git add -A', { cwd: hostDir });
  try {
    execSync('git commit -m "Rename Deploy"', { cwd: hostDir, stdio: 'ignore' });
  } catch (_) {}
  execSync('git branch -M main', { cwd: hostDir });
  execSync(`git remote add origin https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/futrix.git`, { cwd: hostDir });
  
  console.log("- Pushing host code to 'futrix' repository...");
  execSync('git push -u origin main --force', { cwd: hostDir });
  console.log("✓ Code pushed to https://github.com/teamfutrix-byte/futrix");  // Step 3 bypassed: visibility settings are preserved during rename.

  // 4. Fetch Render Owner ID
  const ownerRes = await makeRequest({
    method: 'GET',
    hostname: 'api.render.com',
    path: '/v1/owners?limit=20',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Accept': 'application/json'
    }
  });
  const ownerId = ownerRes.body[0].owner.id;

  // 5. Delete existing Render Web Service pointing to old repo URL
  console.log("\n- Checking for old Render services to remove...");
  const servicesRes = await makeRequest({
    method: 'GET',
    hostname: 'api.render.com',
    path: `/v1/services?ownerId=${ownerId}&limit=50`,
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  if (servicesRes.status === 200 && Array.isArray(servicesRes.body)) {
    const oldService = servicesRes.body.find(s => s.service.name === 'futrix-backend');
    if (oldService) {
      console.log(`- Deleting old service "futrix-backend" (ID: ${oldService.service.id}) to link with new repo...`);
      await makeRequest({
        method: 'DELETE',
        hostname: 'api.render.com',
        path: `/v1/services/${oldService.service.id}`,
        headers: {
          'Authorization': `Bearer ${RENDER_API_KEY}`
        }
      });
      console.log("✓ Old Render service deleted. Waiting 3 seconds for cleanup...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 6. Create new Render Web Service pointing to "futrix" repository
  console.log("- Creating new Render Web Service pointing to 'futrix' repository...");
  const createRes = await makeRequest({
    method: 'POST',
    hostname: 'api.render.com',
    path: '/v1/services',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: {
      type: 'web_service',
      name: 'futrix-backend',
      ownerId,
      repo: `https://github.com/${GITHUB_USERNAME}/futrix`,
      branch: 'main',
      autoDeploy: 'yes',
      serviceDetails: {
        env: 'node',
        plan: 'free',
        envSpecificDetails: {
          buildCommand: 'npm install',
          startCommand: 'node server.js'
        },
        envVars: [
          { key: 'NODE_ENV', value: 'production' },
          { key: 'DB_HOST', value: 'db.dsduytkikxfgiyptdwex.supabase.co' },
          { key: 'DB_PORT', value: '5432' },
          { key: 'DB_USER', value: 'postgres' },
          { key: 'DB_PASSWORD', value: '$anjana@123man' },
          { key: 'DB_NAME', value: 'postgres' }
        ]
      }
    }
  });

  if (createRes.status === 201) {
    console.log("🚀 Render Web Service recreated successfully linking to the renamed repository!");
    console.log(`- New service URL: ${createRes.body.service.serviceDetails.parentUrl || 'Checking Render dashboard...'}`);
  } else {
    console.error("❌ Failed to create Render service:", createRes.body);
  }

  console.log("\n=== RENAME & REDEPLOY PIPELINE COMPLETED ===");
}

run();
