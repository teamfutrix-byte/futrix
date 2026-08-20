const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'tests', 'active-exams.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 1110; i <= 1160; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
