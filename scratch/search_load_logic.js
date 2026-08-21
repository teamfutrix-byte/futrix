const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'student', 'index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('addEventListener') || line.includes('onload') || line.includes('fetch') || line.includes('DOMContentLoaded')) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
