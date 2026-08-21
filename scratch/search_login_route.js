const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'auth', 'login.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('otpModal') || line.includes('closeOtpModal') || line.includes('modalOtpInput')) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
