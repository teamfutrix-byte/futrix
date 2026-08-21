const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'auth', 'admin-login.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let inStyle = false;
lines.forEach((line, index) => {
  if (line.includes('<style>')) inStyle = true;
  if (line.includes('</style>')) inStyle = false;
  if (inStyle && (line.includes('display: flex') || line.includes('display: grid') || line.includes('.container') || line.includes('.login-'))) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
