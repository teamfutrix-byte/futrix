const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'student', 'index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 2606; i <= 2750; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
