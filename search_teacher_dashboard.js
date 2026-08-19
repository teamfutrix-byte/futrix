const fs = require('fs');
const content = fs.readFileSync('teacher-dashboard.html', 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('button') || line.includes('Button') || line.includes('tab-') || line.includes('nav-') || line.includes('id=') || line.includes('class=')) {
    if (line.includes('<button') || line.includes('<a ') || line.includes('<select') || line.includes('<input') || line.includes('tab') || line.includes('onclick')) {
      const trimmed = line.trim();
      if (trimmed.length < 120) {
        console.log(`Line ${idx + 1}: ${trimmed}`);
      }
    }
  }
});
