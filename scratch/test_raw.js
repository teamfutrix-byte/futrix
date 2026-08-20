const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('exam-categories') || line.includes('exam_categories')) {
    console.log(`Line ${i + 1}:`, line.trim());
  }
});
