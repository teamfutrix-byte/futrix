const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'memory-lab', 'memory-lab.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.slice(15, 180).forEach((line, index) => {
  console.log(`L${16 + index}: ${line}`);
});
