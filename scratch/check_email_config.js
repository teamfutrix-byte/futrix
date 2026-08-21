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
  console.log('EMAIL GATEWAY CONFIG IN DB:', {
    smtp_host: config.smtp_host,
    smtp_port: config.smtp_port,
    smtp_user: config.smtp_user,
    sender_email: config.sender_email,
    smtp_pass: config.smtp_pass ? '***' : '(empty)'
  });

  // Try creating a transporter and testing connection
  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: parseInt(config.smtp_port),
    secure: parseInt(config.smtp_port) === 465,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass
    },
    family: 4
  });

  console.log('Verifying transporter connection...');
  try {
    await transporter.verify();
    console.log('Transporter connection VERIFIED successfully!');
  } catch (err) {
    console.error('Transporter verification FAILED:', err.message);
  }
}

main().catch(console.error);
