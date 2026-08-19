const fs = require('fs');
const content = fs.readFileSync('instruction.html', 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('button') || line.includes('Button') || line.includes('Start') || line.includes('start') || line.includes('btn') || line.includes('Btn')) {
    // Only print if the line contains HTML tag or handler
    if (line.includes('<button') || line.includes('<a ') || line.includes('id=') || line.includes('class=')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  }
});
