const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'student', 'index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.slice(2820, 2920).forEach((line, index) => {
  console.log(`L${2821 + index}: ${line}`);
});
