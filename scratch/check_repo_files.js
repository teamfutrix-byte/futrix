const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== '.git' && file !== 'node_modules' && file !== 'futrix-react-app') {
        results = results.concat(walk(fullPath));
      }
    } else {
      if (file.endsWith('.html')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const htmlFiles = walk('C:\\Users\\L470\\Desktop\\Futrix\\Web App\\host');
console.log('HTML files in host/:\n', htmlFiles.map(p => path.relative('C:\\Users\\L470\\Desktop\\Futrix\\Web App\\host', p)).join('\n'));
