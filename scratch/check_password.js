const bcrypt = require('bcryptjs');

const hash = '$2a$10$P7THBOK5Om9dh3XM08iHheKR/VBeooY6ED/q8ZO/ruahTbvIvE7C6';
const password = '$anjana@123man';

bcrypt.compare(password, hash, (err, res) => {
  console.log('PASSWORD MATCH:', res);
});
