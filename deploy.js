const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Load env credentials natively
const envPath = path.join(__dirname, '.env');
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
  console.error("❌ Missing required environment keys in .env. Build terminated.");
  process.exit(1);
}

function makeRequest({ method, hostname, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method,
      hostname,
      path,
      headers: {
        'User-Agent': 'Futrix-Deploy-Agent',
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

async function createGitHubRepo(repoName, isPrivate) {
  console.log(`Checking/Creating GitHub repository: ${repoName}...`);
  const res = await makeRequest({
    method: 'POST',
    hostname: 'api.github.com',
    path: '/user/repos',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    body: {
      name: repoName,
      private: isPrivate,
      auto_init: false
    }
  });

  if (res.status === 201) {
    console.log(`✓ Repository "${repoName}" created successfully on GitHub.`);
  } else if (res.status === 422) {
    console.log(`ℹ Repository "${repoName}" already exists on GitHub.`);
  } else {
    throw new Error(`Failed to create GitHub repo: ${JSON.stringify(res.body)}`);
  }
}

async function pushToGitHub(dir, repoName) {
  console.log(`\nInitializing Git & pushing ${path.basename(dir)} to ${repoName}...`);
  const gitUrl = `https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${repoName}.git`;

  try {
    // Force fresh git history for host deployment to prevent dirty secret states
    if (repoName === 'host-code-web-app') {
      const gitPath = path.join(dir, '.git');
      if (fs.existsSync(gitPath)) {
        fs.rmSync(gitPath, { recursive: true, force: true });
      }
    }

    // Check if git is initialized
    if (!fs.existsSync(path.join(dir, '.git'))) {
      execSync('git init', { cwd: dir });
      console.log("- Initialized empty Git repository.");
    }

    // Set local credentials
    try {
      execSync('git config user.email "deploy-agent@futrix.io"', { cwd: dir });
      execSync('git config user.name "Futrix Deployer"', { cwd: dir });
    } catch (_) {}
    
    // Add all files
    execSync('git add -A', { cwd: dir });
    
    // Commit files
    try {
      execSync('git commit -m "Production Auto Deploy"', { cwd: dir, stdio: 'ignore' });
    } catch (_) {
      console.log("- No changes to commit or committed successfully.");
    }

    // Rename branch to main
    try {
      execSync('git branch -M main', { cwd: dir });
    } catch (_) {}

    // Set remote
    try {
      execSync(`git remote remove origin`, { cwd: dir, stdio: 'ignore' });
    } catch (_) {}
    execSync(`git remote add origin ${gitUrl}`, { cwd: dir });

    // Push code
    console.log("- Pushing code to GitHub...");
    execSync('git push -u origin main --force', { cwd: dir });
    console.log(`✓ Code pushed to https://github.com/${GITHUB_USERNAME}/${repoName}`);
  } catch (err) {
    console.error("❌ Git push failed:", err.message);
    throw err;
  }
}

async function deployToRender() {
  console.log("\nStarting Render deployment...");

  // 1. Get Render Owner ID
  console.log("- Fetching Render Owner ID...");
  const ownerRes = await makeRequest({
    method: 'GET',
    hostname: 'api.render.com',
    path: '/v1/owners?limit=20',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  if (ownerRes.status !== 200 || !ownerRes.body || ownerRes.body.length === 0) {
    throw new Error(`Failed to retrieve Render Owner ID: ${JSON.stringify(ownerRes.body)}`);
  }
  const ownerId = ownerRes.body[0].owner.id;
  console.log(`- Render Owner ID: ${ownerId}`);

  // 2. Check if service already exists
  console.log("- Checking for existing Render services...");
  const servicesRes = await makeRequest({
    method: 'GET',
    hostname: 'api.render.com',
    path: `/v1/services?ownerId=${ownerId}&limit=50`,
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  let existingService = null;
  if (servicesRes.status === 200 && Array.isArray(servicesRes.body)) {
    existingService = servicesRes.body.find(s => s.service.name === 'futrix-backend');
  }

  const repoUrl = `https://github.com/${GITHUB_USERNAME}/host-code-web-app`;

  if (existingService) {
    const serviceId = existingService.service.id;
    console.log(`- Service "futrix-backend" already exists on Render (ID: ${serviceId}). Triggering update deployment...`);
    const deployRes = await makeRequest({
      method: 'POST',
      hostname: 'api.render.com',
      path: `/v1/services/${serviceId}/deploys`,
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Accept': 'application/json'
      },
      body: {}
    });

    if (deployRes.status === 201) {
      console.log(`🚀 Deployment triggered! URL: ${existingService.service.serviceDetails.parentUrl || 'Checking Render dashboard...'}`);
    } else {
      console.error("❌ Failed to trigger Render deploy update:", deployRes.body);
    }
  } else {
    // Create new web service
    console.log("- Creating new Render Web Service...");
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
        repo: repoUrl,
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
      console.log(`🚀 Web Service created successfully! Render is building it now.`);
      console.log(`- Service URL: ${createRes.body.service.serviceDetails.parentUrl || 'Checking Render dashboard...'}`);
    } else {
      throw new Error(`Failed to create Render Web Service: ${JSON.stringify(createRes.body)}`);
    }
  }
}

async function makeRepoPublic(repoName) {
  console.log(`Setting repository visibility to public: ${repoName}...`);
  const res = await makeRequest({
    method: 'PATCH',
    hostname: 'api.github.com',
    path: `/repos/${GITHUB_USERNAME}/${repoName}`,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: {
      private: false
    }
  });

  if (res.status === 200) {
    console.log(`✓ Repository "${repoName}" is now public.`);
  } else {
    console.warn(`[GitHub Warn] Failed to set repository to public:`, res.body);
  }
}

async function run() {
  try {
    // 1. Create GitHub Repositories
    await createGitHubRepo('raw-code-web-app', true);
    await createGitHubRepo('host-code-web-app', true);

    // 2. Push Raw Project Code
    await pushToGitHub(__dirname, 'raw-code-web-app');

    // 3. Push Host Compiled Code
    await pushToGitHub(path.join(__dirname, 'host'), 'host-code-web-app');

    // Make host repository public to allow Render fetching
    try {
      await makeRepoPublic('host-code-web-app');
    } catch (e) {
      console.log(`ℹ Repository visibility check: ${e.message}`);
    }

    // 4. Deploy to Render
    await deployToRender();

    console.log("\n=== DEPLOYMENT AND PACKAGING COMPLETE ===");
  } catch (err) {
    console.error("\n❌ Deployment failed:", err.message);
  }
}

run();
