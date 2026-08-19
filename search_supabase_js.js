const fs = require('fs');
const content = fs.readFileSync('supabase-js.js', 'utf8');

console.log("Includes '/auth/v1/otp':", content.includes('/auth/v1/otp'));
console.log("Includes '/auth/v1/signup':", content.includes('/auth/v1/signup'));
console.log("Length of file:", content.length);
