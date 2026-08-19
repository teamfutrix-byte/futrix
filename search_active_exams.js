const fs = require('fs');
const content = fs.readFileSync('active-exams.html', 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('preparation') || line.includes('Prep') || line.includes('prep') || line.includes('candidatePrep')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
