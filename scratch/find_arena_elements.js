const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'leaderboard', 'arena.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('button') || line.includes('click') || line.includes('battle') || line.includes('Battle')) {
    if (line.includes('id=') || line.includes('class=')) {
      console.log(`L${index + 1}: ${line.trim()}`);
    }
  }
});
