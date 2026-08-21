const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'auth', 'admin-login.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('signIn') || line.includes('session') || line.includes('role') || line.includes('admin') || line.includes('dashboard')) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
