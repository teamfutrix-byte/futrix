const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('fetch(') || line.includes('axios') || line.includes('http.request') || line.includes('https.request')) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
