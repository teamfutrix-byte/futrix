const fs = require('fs');
const path = require('path');
const vm = require('vm');

function validateFile(filename) {
  const filePath = path.join('c:\\Users\\L470\\Desktop\\Futrix\\Web App', filename);
  console.log(`=== Validating ${filename} ===`);
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      const code = match[1].trim();
      if (!code) continue;
      count++;
      try {
        new vm.Script(code);
        console.log(`  Script tag ${count}: OK`);
      } catch (err) {
        console.error(`  [ERROR] Script tag ${count} failed compilation!`);
        console.error(`  Details:`, err.message);
        // Find line number in original HTML file
        const index = match.index;
        const lineNum = html.substring(0, index).split('\n').length;
        console.error(`  Approximate line in HTML: ~${lineNum}`);
      }
    }
  } catch (err) {
    console.error(`Failed to read file:`, err.message);
  }
}

validateFile('features/tests/instruction.html');
validateFile('features/memory-lab/memory-lab.html');
validateFile('features/auth/login.html');
validateFile('features/student/index.html');
