const fs = require('fs');
const path = require('path');

const files = [
  'teacher-dashboard.html',
  'performance.html',
  'login.html',
  'leaderboard.html',
  'instruction.html',
  'index.html',
  'exam.html',
  'arena.html',
  'admin-login.html',
  'admin-dashboard.html',
  'active-exams.html'
];

function replaceTags() {
  for (const file of files) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')) {
        console.log(`Replacing CDN tag in ${file}...`);
        content = content.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/g, 'supabase-js.js');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[✓] Replaced in ${file}`);
      }
    }
  }
}

replaceTags();
