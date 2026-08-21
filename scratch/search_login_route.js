const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('app.post') && (line.includes('login') || line.includes('signin') || line.includes('auth'))) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
