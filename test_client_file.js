const fs = require('fs');

try {
  const content = fs.readFileSync('supabase-client.js', 'utf8');
  console.log('supabase-client.js read success. Length:', content.length);
  // Check if there are any weird chars or syntax errors
  eval(content);
  console.log('supabase-client.js evaluated in node successfully!');
} catch (err) {
  console.error('Error evaluating supabase-client.js in node:', err.message);
}
