const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'teacher', 'teacher-dashboard.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let inStyle = false;
lines.forEach((line, index) => {
  if (line.includes('<style>')) inStyle = true;
  if (line.includes('</style>')) inStyle = false;
  if (inStyle && (line.includes('grid-template-columns') || line.includes('display: grid') || line.includes('.stats-') || line.includes('.charts-'))) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
