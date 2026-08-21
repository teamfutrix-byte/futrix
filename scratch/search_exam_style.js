const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'tests', 'exam.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let inStyle = false;
lines.forEach((line, index) => {
  if (line.includes('<style>')) inStyle = true;
  if (line.includes('</style>')) inStyle = false;
  if (inStyle && (line.includes('review-') || line.includes('.result-'))) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
