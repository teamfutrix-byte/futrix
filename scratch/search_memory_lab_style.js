const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'memory-lab', 'memory-lab.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('<style>') || line.includes('</style>') || line.includes('<link rel="stylesheet"')) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
