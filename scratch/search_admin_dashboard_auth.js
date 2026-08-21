const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'super-admin', 'admin-dashboard.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('localStorage') || line.includes('sessionStorage') || line.includes('role') || line.includes('logout') || line.includes('login') || line.includes('redirect')) {
    if (line.trim().startsWith('//') || line.includes('auth') || line.includes('User') || line.includes('Admin') || line.includes('Location')) {
      console.log(`L${index + 1}: ${line.trim()}`);
    }
  }
});
