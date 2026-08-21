const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'student', 'index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('stream') || line.includes('Stream') || line.includes('button') || line.includes('class="btn') || line.includes('NEET')) {
    if (line.includes('<button') || line.includes('class=')) {
      console.log(`L${index + 1}: ${line.trim()}`);
    }
  }
});
