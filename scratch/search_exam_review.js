const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'tests', 'exam.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('review') || line.includes('result') || line.includes('Review') || line.includes('Result') || line.includes('submit')) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
