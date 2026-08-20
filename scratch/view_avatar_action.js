const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'features', 'tests', 'active-exams.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('topUserBtn') || line.includes('profileModal') || line.includes('userModal') || line.includes('editProfile')) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
