const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'host', 'features', 'super-admin', 'admin-dashboard.html');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('admin-login.html')) {
      console.log(`L${index + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('File does not exist inside host/ yet. Run compilation first.');
}
