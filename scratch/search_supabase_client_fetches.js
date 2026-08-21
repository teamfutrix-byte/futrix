const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase-client.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('fetch') || line.includes('/api/')) {
    console.log(`L${index + 1}: ${line.trim()}`);
  }
});
