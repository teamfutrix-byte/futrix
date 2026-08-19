const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'host', 'features', 'tests', 'instruction.html');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('File length:', content.length);
  // Search for occurrence of exam.html
  const index = content.indexOf('exam.html');
  if (index !== -1) {
    console.log('Found exam.html! Context:');
    console.log(content.substring(Math.max(0, index - 100), Math.min(content.length, index + 100)));
  } else {
    console.log('exam.html not found in compiled instruction.html!');
  }
} else {
  console.log('compiled instruction.html not found!');
}
