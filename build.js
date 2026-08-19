const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("=== STARTING FUTRIX PRODUCTION BUILD & OBFUSCATION PIPELINE ===");

// 1. Install javascript-obfuscator if missing
try {
  require('javascript-obfuscator');
  console.log("✓ javascript-obfuscator is already installed.");
} catch (e) {
  console.log("Installing javascript-obfuscator as a build tool...");
  execSync('npm install --no-save javascript-obfuscator', { stdio: 'inherit' });
}

const Obfuscator = require('javascript-obfuscator');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'host');

// Clean and create target host directory
if (fs.existsSync(destDir)) {
  console.log("Cleaning existing host directory...");
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir);

const ignorePaths = [
  'node_modules',
  'host',
  '.git',
  '.gemini',
  '.agents',
  'build.js',
  'implementation_plan.md',
  'walkthrough.md',
  'task.md',
  '.env',
  '.gitignore',
  'deploy.js'
];

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,
  controlFlowFlatteningThreshold: 0,
  numbersToExpressions: true,
  simplify: true,
  stringArray: true,
  stringArrayThreshold: 0.75,
  splitStrings: true,
  splitStringsChunkLength: 8,
  unicodeEscapeSequence: true
};

const devToolsBlockerScript = `
<script>
  // FUTRIX Enterprise Client Security Shield
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
      (e.ctrlKey && e.key === 'U')
    ) {
      e.preventDefault();
    }
  });
  // Anti-debugging loop
  (function() {
    setInterval(function() {
      const start = Date.now();
      debugger;
      if (Date.now() - start > 100) {
        window.location.href = "about:blank";
      }
    }, 200);
  })();
</script>
`;

function copyAndProcessRecursive(currentSrc, currentDest) {
  const stat = fs.statSync(currentSrc);

  if (stat.isDirectory()) {
    // Create directory in destination
    if (!fs.existsSync(currentDest)) {
      fs.mkdirSync(currentDest);
    }

    const files = fs.readdirSync(currentSrc);
    for (const file of files) {
      if (ignorePaths.includes(file)) continue;
      copyAndProcessRecursive(path.join(currentSrc, file), path.join(currentDest, file));
    }
  } else {
    const ext = path.extname(currentSrc);
    const filename = path.basename(currentSrc);

    // Calculate relative prefix based on path depth from destDir
    const relativePathFromDest = path.relative(destDir, currentDest);
    const depth = relativePathFromDest.split(path.sep).length - 1;
    const relativePrefix = depth > 0 ? '../'.repeat(depth) : './';

    if (ext === '.js' && filename !== 'server.js' && filename !== 'supabase-js.js' && filename !== 'supabase-client.js') {
      // Obfuscate standalone client-side JS files
      console.log(`Obfuscating JS: ${path.relative(srcDir, currentSrc)}`);
      let content = fs.readFileSync(currentSrc, 'utf8');

      // Replace leading slash redirects (location.href = '/...') with relative paths
      content = content.replace(/(location\.href\s*=\s*|location\.replace\()(["'])\/([^/][^"']*)(["'])/g, `$1$2${relativePrefix}$3$4`);

      try {
        const result = Obfuscator.obfuscate(content, obfuscatorOptions);
        fs.writeFileSync(currentDest, result.getObfuscatedCode(), 'utf8');
      } catch (err) {
        console.warn(`[Build Warn] Failed to obfuscate JS ${filename}, copying raw:`, err.message);
        fs.writeFileSync(currentDest, content, 'utf8');
      }
    } else if (ext === '.html') {
      // Process HTML files, obfuscate inline script blocks
      console.log(`Securing HTML: ${path.relative(srcDir, currentSrc)}`);
      let html = fs.readFileSync(currentSrc, 'utf8');

      // Replace leading slash links (src="/..." and href="/...") with relative paths
      html = html.replace(/(src|href)="\/([^/][^"]*)"/g, `$1="${relativePrefix}$2"`);
      html = html.replace(/(src|href)='\/([^/][^']*)'/g, `$1='${relativePrefix}$2'`);

      // Replace leading slash redirects (location.href = '/...') with relative paths in HTML script blocks
      html = html.replace(/(location\.href\s*=\s*|location\.replace\()(["'])\/([^/][^"']*)(["'])/g, `$1$2${relativePrefix}$3$4`);

      // Bust browser cache for key JS files (supabase-js.js and supabase-client.js)
      html = html.replace(/src="([^"]*supabase-js\.js)(?:\?v=[^"]*)?"/g, 'src="$1?v=202608183"');
      html = html.replace(/src="([^"]*supabase-client\.js)(?:\?v=[^"]*)?"/g, 'src="$1?v=202608183"');
      html = html.replace(/src='([^']*supabase-js\.js)(?:\?v=[^']*)?'/g, "src='$1?v=202608183'");
      html = html.replace(/src='([^']*supabase-client\.js)(?:\?v=[^']*)?'/g, "src='$1?v=202608183'");

      // Inject DevTools blocker script right after <head> or at the beginning of <body>
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>\n${devToolsBlockerScript}`);
      } else {
        html = devToolsBlockerScript + html;
      }

      // Regex to find all script blocks
      const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      let offset = 0;
      
      // Parse and replace script blocks
      html = html.replace(scriptRegex, (matchedTag, scriptBody) => {
        // Only obfuscate script blocks with code (not external src loads or config templates)
        if (!scriptBody.trim() || matchedTag.includes('src=')) {
          return matchedTag;
        }
        
        try {
          const result = Obfuscator.obfuscate(scriptBody, obfuscatorOptions);
          return `<script>${result.getObfuscatedCode()}</script>`;
        } catch (err) {
          console.warn(`[Build Warn] Failed to obfuscate inline script block:`, err.message);
          return matchedTag;
        }
      });

      fs.writeFileSync(currentDest, html, 'utf8');
    } else {
      // Copy other files unmodified (images, CSS, server.js, configs)
      fs.copyFileSync(currentSrc, currentDest);
    }
  }
}

// 2. Start copying and compiling files
console.log("Processing files...");

// Copy backend and main assets to public or root
const topLevelFiles = fs.readdirSync(srcDir);
for (const file of topLevelFiles) {
  if (ignorePaths.includes(file)) continue;

  const srcPath = path.join(srcDir, file);
  const destPath = path.join(destDir, file);

  // Copy all assets directly to host root
  copyAndProcessRecursive(srcPath, destPath);
}

// 3. Create production package.json inside /host
const productionPackage = {
  name: "futrix-production",
  version: "1.0.0",
  main: "server.js",
  scripts: {
    "start": "NODE_ENV=production node server.js"
  },
  dependencies: {
    "@supabase/supabase-js": "^2.108.2",
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "nodemailer": "^9.0.3",
    "pg": "^8.22.0",
    "xlsx": "^0.18.5"
  }
};
fs.writeFileSync(path.join(destDir, 'package.json'), JSON.stringify(productionPackage, null, 2), 'utf8');

console.log("\n=== FUTRIX PRODUCTION BUILD COMPLETED SUCCESSFULLY ===");
console.log("Production ready project generated in: ./host");
