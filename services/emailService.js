const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { getDbClient } = require('../config/db');

async function getEmailConfigFromDb() {
  const db = getDbClient();
  try {
    await db.connect();
    const { rows } = await db.query("SELECT value FROM public.platform_configs WHERE key = 'email_gateway_config'");
    await db.end();
    if (rows.length > 0) {
      const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      return val;
    }
  } catch (err) {
    console.error('[EMAIL SERVICE] Error fetching config from DB:', err.message);
    try { await db.end(); } catch (_) {}
  }
  return null;
}

async function sendOtpEmail(email, otpCode, fullName = 'User', role = 'student') {
  const dbConfig = await getEmailConfigFromDb();

  const host = dbConfig && dbConfig.smtp_host ? dbConfig.smtp_host : (process.env.SMTP_HOST || 'smtp.gmail.com');
  const port = dbConfig && dbConfig.smtp_port ? parseInt(dbConfig.smtp_port) : (parseInt(process.env.SMTP_PORT) || 465);
  const user = dbConfig && dbConfig.smtp_user ? dbConfig.smtp_user : (process.env.SMTP_USER || '');
  const pass = dbConfig && dbConfig.smtp_pass ? dbConfig.smtp_pass : (process.env.SMTP_PASS || '');
  const senderEmail = dbConfig && dbConfig.sender_email ? dbConfig.sender_email : (process.env.SMTP_FROM || user || 'noreply@futrix.com');

  console.log(`[EMAIL SERVICE] Initializing transporter - Host: ${host}, Port: ${port}, User: ${user}, Sender: ${senderEmail}`);

  let transporter;
  if (user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      },
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      tls: {
        rejectUnauthorized: false
      }
    });
  } else {
    transporter = nodemailer.createTransport({
      jsonTransport: true
    });
  }

  const titleRole = role.charAt(0).toUpperCase() + role.slice(1);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark">
      <meta name="supported-color-schemes" content="dark">
      <title>Futrix Verification Code</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Outfit', sans-serif; margin: 0; padding: 0; }
        @keyframes neonBorder {
          0% { border-color: #38bdf8; box-shadow: 0 0 10px rgba(56, 189, 248, 0.4); }
          50% { border-color: #818cf8; box-shadow: 0 0 25px rgba(129, 140, 248, 0.8); }
          100% { border-color: #38bdf8; box-shadow: 0 0 10px rgba(56, 189, 248, 0.4); }
        }
        .neon-pulse { animation: neonBorder 3s infinite; }
      </style>
    </head>
    <body style="background-color: #0b0f19 !important; background-image: linear-gradient(180deg, #0b0f19 0%, #0b0f19 100%) !important; font-family: 'Outfit', sans-serif; padding: 30px 10px; margin: 0; color: #f0f9ff; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19 !important; background-image: linear-gradient(180deg, #0b0f19 0%, #0b0f19 100%) !important;">
        <tr>
          <td align="center" style="padding: 10px;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="neon-pulse" style="max-width: 500px; background-color: #0f172a !important; background-image: linear-gradient(180deg, #0f172a 0%, #0f172a 100%) !important; border: 2px solid #38bdf8; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
              
              <!-- Header Row -->
              <tr>
                <td align="center" style="padding: 35px 20px; background-color: #1e293b !important; background-image: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                  <div style="font-size: 32px; font-weight: 800; font-family: 'Outfit', sans-serif; line-height: 1.1;">
                    <span style="color: #f0f9ff !important; -webkit-text-fill-color: #f0f9ff !important;">Fut</span><span style="color: #38bdf8 !important; -webkit-text-fill-color: #38bdf8 !important;">rix</span>
                  </div>
                  <div style="font-size: 11px; font-weight: 700; color: #818cf8 !important; -webkit-text-fill-color: #818cf8 !important; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 8px;">
                    ${titleRole} Account Verification
                  </div>
                </td>
              </tr>

              <!-- Content Row -->
              <tr>
                <td align="center" style="padding: 35px 25px; background-color: #0f172a !important; background-image: linear-gradient(180deg, #0f172a 0%, #0f172a 100%) !important;">
                  <div style="font-size: 22px; font-weight: 700; color: #f0f9ff !important; -webkit-text-fill-color: #f0f9ff !important; font-family: 'Outfit', sans-serif; margin-bottom: 14px; letter-spacing: -0.02em;">
                    System Authentication
                  </div>
                  <div style="font-size: 14px; color: #cbd5e1 !important; -webkit-text-fill-color: #cbd5e1 !important; font-family: 'Outfit', sans-serif; line-height: 1.6; margin-bottom: 25px;">
                    <span style="color: #cbd5e1 !important; -webkit-text-fill-color: #cbd5e1 !important;">Hello </span><strong style="color: #7dd3fc !important; -webkit-text-fill-color: #7dd3fc !important;">${fullName}</strong>,<br>
                    <span style="color: #cbd5e1 !important; -webkit-text-fill-color: #cbd5e1 !important;">Please use the secure token verification key below:</span>
                  </div>

                  <!-- Glassmorphic Cyberpunk Card Table -->
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: rgba(255, 255, 255, 0.03) !important; background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.03) 100%) !important; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 20px; margin: 25px 0;">
                    <tr>
                      <td align="center" style="padding: 25px 15px;">
                        <div style="font-size: 10px; font-weight: 700; color: #38bdf8 !important; -webkit-text-fill-color: #38bdf8 !important; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.20em; margin-bottom: 12px;">
                          🔑 TOKEN DECRYPTION KEY
                        </div>
                        <div style="font-size: 32px; font-weight: 800; color: #38bdf8 !important; -webkit-text-fill-color: #38bdf8 !important; letter-spacing: 0.25em; font-family: monospace; line-height: 1; white-space: nowrap; word-break: keep-all; display: inline-block;">
                          ${otpCode}
                        </div>
                      </td>
                    </tr>
                  </table>

                  <div style="font-size: 12px; color: #64748b !important; -webkit-text-fill-color: #64748b !important; font-family: 'Outfit', sans-serif; margin-top: 25px;">
                    This token expires in 10 minutes. Do not share this key with anyone.
                  </div>
                </td>
              </tr>

              <!-- Footer Row -->
              <tr>
                <td align="center" style="padding: 20px 30px; background-color: #0a0d14 !important; background-image: linear-gradient(180deg, #0a0d14 0%, #0a0d14 100%) !important; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                  <div style="font-size: 11px; color: #475569 !important; -webkit-text-fill-color: #475569 !important; font-family: 'Outfit', sans-serif;">
                    &copy; ${new Date().getFullYear()} Futrix System Intelligence. All rights reserved.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Futrix Verification" <${senderEmail}>`,
    to: email,
    subject: `${otpCode} is your Futrix Verification Code [#${Date.now().toString().slice(-4)}]`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] Sent OTP ${otpCode} to ${email}. MessageId: ${info.messageId || 'JSON_DEBUG'}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send email to ${email}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendWelcomeKitEmail(email, fullName, role = 'student') {
  const dbConfig = await getEmailConfigFromDb();

  const host = dbConfig && dbConfig.smtp_host ? dbConfig.smtp_host : (process.env.SMTP_HOST || 'smtp.gmail.com');
  const port = dbConfig && dbConfig.smtp_port ? parseInt(dbConfig.smtp_port) : (parseInt(process.env.SMTP_PORT) || 465);
  const user = dbConfig && dbConfig.smtp_user ? dbConfig.smtp_user : (process.env.SMTP_USER || '');
  const pass = dbConfig && dbConfig.smtp_pass ? dbConfig.smtp_pass : (process.env.SMTP_PASS || '');
  const senderEmail = dbConfig && dbConfig.sender_email ? dbConfig.sender_email : (process.env.SMTP_FROM || user || 'noreply@futrix.com');

  let transporter;
  if (user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      tls: {
        rejectUnauthorized: false
      }
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  const titleRole = role.charAt(0).toUpperCase() + role.slice(1);
  const isTeacher = role === 'teacher';
  
  const subject = isTeacher
    ? 'Welcome to FUTRIX Educator Portal'
    : 'Welcome to FUTRIX — Your Learning Journey Starts Today';

  const dashboardUrl = isTeacher
    ? 'http://localhost:8000/features/teacher/teacher-dashboard.html'
    : 'http://localhost:8000/active-exams.html';

  const userManualUrl = isTeacher
    ? `http://localhost:8000/api/onboarding/download?file=user-manual.pdf&role=teacher&email=${encodeURIComponent(email)}`
    : `http://localhost:8000/api/onboarding/download?file=user-manual.pdf&role=candidate&email=${encodeURIComponent(email)}`;

  const trackPixelUrl = `http://localhost:8000/api/onboarding/track-open?email=${encodeURIComponent(email)}&role=${role}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; margin: 0; padding: 0; background-color: #0b0f19; }
      </style>
    </head>
    <body style="background-color: #0b0f19 !important; padding: 30px 10px; margin: 0; color: #f0f9ff;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19 !important;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #0f172a !important; border: 2px solid #38bdf8; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
              
              <!-- Header Row -->
              <tr>
                <td align="center" style="padding: 35px 20px; background-color: #1e293b !important; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                  <div style="font-size: 32px; font-weight: 800; font-family: 'Outfit', sans-serif; line-height: 1.1;">
                    <span style="color: #f0f9ff !important;">Fut</span><span style="color: #38bdf8 !important;">rix</span>
                  </div>
                  <div style="font-size: 11px; font-weight: 700; color: #818cf8 !important; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 8px;">
                    Welcome to the Futrix Ecosystem
                  </div>
                </td>
              </tr>

              <!-- Content Row -->
              <tr>
                <td style="padding: 35px 25px; font-family: 'Plus Jakarta Sans', sans-serif; line-height: 1.6; color: #cbd5e1;">
                  <div style="font-size: 22px; font-weight: 700; color: #f0f9ff !important; margin-bottom: 15px; font-family: 'Outfit', sans-serif; text-align: center;">
                    Welcome Aboard! 🎉
                  </div>
                  
                  <p style="margin-bottom: 15px;">Hello <strong style="color:#7dd3fc;">${fullName}</strong>,</p>
                  
                  <p style="margin-bottom: 15px;">Thank you for joining FUTRIX. We are absolutely thrilled to have you as part of our platform! Whether you are here to learn and conquer competitive exams or to guide the next generation of top performers, our platform provides all the tools you need to succeed.</p>
                  
                  <p style="margin-bottom: 25px; font-style: italic; color: #818cf8; font-weight: 600; text-align: center;">"Our mission: To cultivate cognitive excellence and supercharge learning efficiency."</p>
                  
                  <!-- CTA Buttons -->
                  <div align="center" style="margin-bottom: 30px;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #38bdf8, #818cf8); color: #ffffff !important; text-decoration: none; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3); font-size: 14px; margin-bottom: 15px;">🚀 Launch Portal Dashboard</a>
                    <br>
                    <a href="${userManualUrl}" style="display: inline-block; padding: 10px 22px; background: rgba(255, 255, 255, 0.05); color: #7dd3fc !important; border: 1px solid rgba(56, 189, 248, 0.3); text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 13px;">📖 Download Detailed User Manual (PDF)</a>
                  </div>

                  <!-- Quick Start Guide -->
                  <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 16px; padding: 20px; margin-bottom: 25px;">
                    <div style="font-weight: 700; color: #f0f9ff; font-family: 'Outfit', sans-serif; font-size: 15px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;">⚡ Quick Start Checklist</div>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #cbd5e1;">
                      <li style="margin-bottom: 8px;">Log in to your Futrix Portal Dashboard.</li>
                      <li style="margin-bottom: 8px;">Explore your tailored onboarding tour guide.</li>
                      <li style="margin-bottom: 8px;">Attempt your first practice test series.</li>
                      <li style="margin-bottom: 8px;">Review incorrect answers in the Memory Lab.</li>
                      <li style="margin-bottom: 8px;">Join our community channels for study updates.</li>
                    </ul>
                  </div>

                  <p style="margin-bottom: 15px; font-size: 13px;">We have attached your official **Welcome Letter**, **Getting Started Guide**, **Platform Rules**, and **Support Details** directly to this email for your convenience.</p>

                  <!-- WhatsApp CTA -->
                  <div align="center" style="margin-top: 30px;">
                    <p style="font-size: 12px; margin-bottom: 8px;">Stay updated via our official WhatsApp community:</p>
                    <a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" style="display: inline-block; padding: 10px 24px; background: #25d366; color: #ffffff !important; text-decoration: none; font-weight: 700; border-radius: 8px; font-size: 13px; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.25);">💬 Join WhatsApp Community</a>
                  </div>
                </td>
              </tr>

              <!-- Footer Row -->
              <tr>
                <td align="center" style="padding: 30px 20px; background-color: #0a0d14 !important; border-top: 1px solid rgba(255, 255, 255, 0.05); font-family: 'Plus Jakarta Sans', sans-serif;">
                  <!-- Social Links -->
                  <div style="margin-bottom: 15px; font-size: 12px;">
                    <a href="https://www.instagram.com/futrix_official/" style="color: #38bdf8; text-decoration: none; margin: 0 10px;">Instagram</a> |
                    <a href="https://www.facebook.com/profile.php?id=61590709965442" style="color: #38bdf8; text-decoration: none; margin: 0 10px;">Facebook</a> |
                    <a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" style="color: #38bdf8; text-decoration: none; margin: 0 10px;">WhatsApp</a>
                  </div>
                  <div style="font-size: 11px; color: #475569;">
                    &copy; 2026 Futrix System Intelligence. All rights reserved.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <!-- Invisible 1x1 tracking pixel for open rate metrics -->
      <img src="${trackPixelUrl}" width="1" height="1" style="display:none;" />
    </body>
    </html>
  `;

  // Define role-specific attachments
  const onboardingFolder = path.join(__dirname, '../assets/onboarding', isTeacher ? 'teacher' : 'candidate');
  const candidateAttachments = [
    { filename: 'Welcome-Letter.pdf', path: path.join(onboardingFolder, 'welcome-letter.pdf') },
    { filename: 'Quick-Start-Guide.pdf', path: path.join(onboardingFolder, 'quick-start.pdf') },
    { filename: 'Platform-Rules.pdf', path: path.join(onboardingFolder, 'rules.pdf') },
    { filename: 'Exam-Guidelines.pdf', path: path.join(onboardingFolder, 'exam-guidelines.pdf') },
    { filename: 'Privacy-Policy.pdf', path: path.join(onboardingFolder, 'privacy-policy.pdf') },
    { filename: 'Terms-And-Conditions.pdf', path: path.join(onboardingFolder, 'terms.pdf') },
    { filename: 'Contact-Support.pdf', path: path.join(onboardingFolder, 'contact.pdf') }
  ];

  const teacherAttachments = [
    { filename: 'Welcome-Letter.pdf', path: path.join(onboardingFolder, 'welcome-letter.pdf') },
    { filename: 'Quick-Start-Guide.pdf', path: path.join(onboardingFolder, 'quick-start.pdf') },
    { filename: 'Teacher-Guidelines.pdf', path: path.join(onboardingFolder, 'teacher-guidelines.pdf') },
    { filename: 'Platform-Rules.pdf', path: path.join(onboardingFolder, 'rules.pdf') },
    { filename: 'Privacy-Policy.pdf', path: path.join(onboardingFolder, 'privacy-policy.pdf') },
    { filename: 'Terms-And-Conditions.pdf', path: path.join(onboardingFolder, 'terms.pdf') },
    { filename: 'Contact-Support.pdf', path: path.join(onboardingFolder, 'contact.pdf') }
  ];

  const attachments = isTeacher ? teacherAttachments : candidateAttachments;

  const mailOptions = {
    from: `"Futrix Onboarding" <${senderEmail}>`,
    to: email,
    subject: subject,
    html: htmlContent,
    attachments: attachments.filter(att => fs.existsSync(att.path))
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] Sent Welcome Kit to ${email} (${role}). MessageId: ${info.messageId || 'JSON_DEBUG'}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send welcome kit to ${email}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOtpEmail,
  sendWelcomeKitEmail
};
