const { getDbClient } = require('../config/db');
const nodemailer = require('nodemailer');

async function main() {
  const db = getDbClient();
  await db.connect();
  const { rows } = await db.query("SELECT value FROM public.platform_configs WHERE key = 'email_gateway_config'");
  await db.end();

  if (rows.length === 0) {
    console.log('No email config found in database.');
    return;
  }

  const config = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
  console.log('Testing with port 587...');
  const transporter587 = nodemailer.createTransport({
    host: config.smtp_host,
    port: 587,
    secure: false, // false for 587
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass
    },
    family: 4
  });

  try {
    await transporter587.verify();
    console.log('Port 587 connection verified successfully!');
  } catch (err) {
    console.error('Port 587 connection failed:', err.message);
  }
}

main().catch(console.error);
