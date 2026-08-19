const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

const BRAND_STYLE = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    
    :root {
      --primary: #38bdf8;
      --primary-glow: rgba(56, 189, 248, 0.4);
      --secondary: #818cf8;
      --bg: #0b0f19;
      --card-bg: #0f172a;
      --text: #f0f9ff;
      --text-muted: #94a3b8;
      --border: rgba(56, 189, 248, 0.2);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 40px;
      line-height: 1.6;
    }

    .document-card {
      max-width: 800px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 2px solid var(--primary);
      border-radius: 24px;
      padding: 50px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      position: relative;
      overflow: hidden;
    }

    .header {
      text-align: center;
      border-bottom: 2px solid var(--border);
      padding-bottom: 30px;
      margin-bottom: 40px;
    }

    .logo {
      font-family: 'Outfit', sans-serif;
      font-size: 42px;
      font-weight: 800;
      letter-spacing: -1px;
    }

    .logo .white { color: #ffffff; }
    .logo .cyan { color: var(--primary); }

    .subtitle {
      font-size: 13px;
      color: var(--secondary);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-top: 10px;
    }

    .title {
      font-size: 28px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 20px;
      text-shadow: 0 0 10px var(--primary-glow);
    }

    h3 {
      font-size: 18px;
      color: var(--primary);
      margin: 25px 0 10px 0;
      font-family: 'Outfit', sans-serif;
    }

    p {
      color: var(--text-muted);
      margin-bottom: 15px;
      font-size: 14px;
    }

    ol, ul {
      margin-left: 20px;
      margin-bottom: 20px;
      color: var(--text-muted);
      font-size: 14px;
    }

    li {
      margin-bottom: 8px;
    }

    .cta-button {
      display: inline-block;
      margin-top: 25px;
      padding: 14px 35px;
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(56, 189, 248, 0.4);
      font-size: 14px;
      transition: all 0.3s ease;
      text-align: center;
    }

    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 11px;
      color: var(--text-muted);
    }

    .meta-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 15px;
      margin-bottom: 35px;
      font-size: 12px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .meta-label {
      color: var(--secondary);
      font-weight: 700;
    }

    /* Page breaks for multi-page user manuals */
    .page-break {
      page-break-before: always;
      padding-top: 30px;
    }
  </style>
`;

const LANDSCAPE_STYLE = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    
    :root {
      --primary: #38bdf8;
      --primary-glow: rgba(56, 189, 248, 0.4);
      --secondary: #818cf8;
      --bg: #0b0f19;
      --card-bg: #0f172a;
      --text: #f0f9ff;
      --text-muted: #94a3b8;
      --border: rgba(56, 189, 248, 0.2);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 20px;
      line-height: 1.5;
    }

    .slide {
      width: 100%;
      height: 100%;
      background: var(--card-bg);
      border: 2px solid var(--primary);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 15px 30px rgba(0, 0, 0, 0.5);
      position: relative;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .logo {
      font-family: 'Outfit', sans-serif;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -1px;
    }

    .logo .white { color: #ffffff; }
    .logo .cyan { color: var(--primary); }

    .slide-title {
      font-size: 24px;
      color: #ffffff;
      margin-bottom: 15px;
      text-shadow: 0 0 10px var(--primary-glow);
    }

    .slide-content {
      font-size: 13px;
      color: var(--text-muted);
      flex-grow: 1;
    }

    .slide-footer {
      font-size: 10px;
      color: var(--secondary);
      border-top: 1px solid var(--border);
      padding-top: 10px;
      margin-top: 15px;
      display: flex;
      justify-content: space-between;
    }
  </style>
`;

async function generatePDF(htmlContent, outputPath, landscape = false) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    landscape: landscape,
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm'
    }
  });

  await browser.close();
  console.log(`- Generated PDF: ${outputPath}`);
}

async function main() {
  console.log("Generating Futrix Onboarding Welcome Kit Documents...");

  const candidateDir = path.join(__dirname, '../assets/onboarding/candidate');
  const teacherDir = path.join(__dirname, '../assets/onboarding/teacher');
  const pptDir = path.join(__dirname, '../assets/onboarding/ppt');

  // Create directories
  fs.mkdirSync(candidateDir, { recursive: true });
  fs.mkdirSync(teacherDir, { recursive: true });
  fs.mkdirSync(pptDir, { recursive: true });

  const generatedAssets = [];

  // ==================== CANDIDATE DOCUMENTS ====================

  // 1. Candidate Welcome Letter
  const welcomeLetterHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Platform Onboarding System</div>
        </div>
        <div class="meta-box">
          <div class="meta-grid">
            <div><span class="meta-label">Document:</span> Welcome Letter</div>
            <div><span class="meta-label">Version:</span> 1.0.0</div>
            <div><span class="meta-label">Authorized For:</span> Candidate Competitor</div>
            <div><span class="meta-label">Date:</span> July 2026</div>
          </div>
        </div>
        <h2 class="title">Welcome to Futrix!</h2>
        <p>Dear Candidate,</p>
        <p>We are absolutely thrilled to welcome you to the Futrix competitive exam platform! Our mission is to empower you with the tools, memory techniques, and high-fidelity test simulations needed to master your exams and excel academically.</p>
        <p>Your account has been successfully verified and activated. You now have full access to our personalized study features, including the Memory Lab, live test series, global leaderboards, and instant performance analytics.</p>
        <p>This welcome kit includes everything you need to start your journey confidently. Please review the enclosed User Manual, Platform Rules, and Quick Start Guide.</p>
        <p>Remember, consistency is the key to academic success. Your learning journey starts today!</p>
        <br>
        <p>Best regards,</p>
        <p><strong>The Futrix Team</strong></p>
        <a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" class="cta-button">Join WhatsApp Community</a>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const welcomeLetterPath = path.join(candidateDir, 'welcome-letter.pdf');
  await generatePDF(welcomeLetterHTML, welcomeLetterPath);
  generatedAssets.push({ filename: 'welcome-letter.pdf', user_type: 'candidate', file_path: '/assets/onboarding/candidate/welcome-letter.pdf' });

  // 2. Candidate User Manual (Rich structure, 20-30 pages layout simulation)
  let manualHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Platform Onboarding System</div>
        </div>
        <div class="meta-box">
          <div class="meta-grid">
            <div><span class="meta-label">Document:</span> Candidate User Manual</div>
            <div><span class="meta-label">Version:</span> 1.0.0</div>
            <div><span class="meta-label">Status:</span> Published</div>
            <div><span class="meta-label">Revision History:</span> v1.0.0 (Initial Release)</div>
          </div>
        </div>
        <h2 class="title">Candidate Competitor Manual</h2>
        <h3>Table of Contents</h3>
        <ol>
          <li>Introduction to Futrix</li>
          <li>Registration & Verification</li>
          <li>Competitor Dashboard</li>
          <li>Profile Management</li>
          <li>Daily & Mock Tests</li>
          <li>Result & Performance Analytics</li>
          <li>XP & Rewards System</li>
          <li>Global Leaderboards</li>
          <li>Memory Lab & Revision Modules</li>
          <li>Premium Pro Features</li>
          <li>Security, FAQs & Support</li>
        </ol>

        <div class="page-break"></div>
        <h3>1. Introduction to Futrix</h3>
        <p>Futrix is a state-of-the-art enterprise-grade learning and testing platform designed for competitive exam aspirants. By combining advanced cognitive science, gamification, and performance intelligence, Futrix makes learning engaging and results-driven.</p>

        <h3>2. Registration & Verification</h3>
        <p>Your registration process is complete once your email OTP is verified. Once verified, a profile is generated for you with an initial registration reward of 100 XP. You can manage your profile, educational categories, and goals at any time.</p>

        <div class="page-break"></div>
        <h3>3. Competitor Dashboard</h3>
        <p>The dashboard is your central command center. Here you can see your active exams, performance summaries, active study streaks, daily objectives, and fast navigation buttons to revision modules and flashcards.</p>

        <h3>4. Profile Management</h3>
        <p>Complete your profile details, including date of birth, qualification, target exam preparation (e.g. JEE, NEET, Civil Services), and contact numbers. A completed profile optimizes Futrix AI algorithms to suggest highly relevant mock tests.</p>

        <div class="page-break"></div>
        <h3>5. Daily & Mock Tests</h3>
        <p>Navigate to "Active Exams" to attempt daily timed test sessions or full-length mock examinations. High-fidelity exam screen interfaces simulate real-world test environments to eliminate technical exam-day anxiety.</p>

        <h3>6. Result & Performance Analytics</h3>
        <p>Immediately after test submission, access detailed score reports. Futrix provides question-by-question breakdown, accuracy percentage, time-spent analysis, and subject-wise strength metrics.</p>

        <div class="page-break"></div>
        <h3>7. XP & Rewards System</h3>
        <p>Earn XP (Experience Points) by completing tests, maintaining study streaks, referring authentic friends, and mastering revision decks. XP balances qualify you for higher league tiers and unlock premium avatar cards.</p>

        <h3>8. Global Leaderboards</h3>
        <p>See where you stand in the global competitor arena. The real-time leaderboard ranks candidates globally and within preparation categories to foster healthy competitive drive.</p>

        <div class="page-break"></div>
        <h3>9. Memory Lab & Revision Modules</h3>
        <p>The Memory Lab uses Spaced Repetition System (SRS) algorithms to schedule cards you previously answered incorrectly. This scientifically increases retention and guarantees revision efficiency.</p>

        <h3>10. Premium Pro Features</h3>
        <p>Unlock detailed AI Mentorship, custom test creators, unlimited flashcards, and advanced analytical reports by upgrading to Futrix PRO.</p>

        <h3>11. Support, FAQs & Security</h3>
        <p>Our help desk is online 24/7. Find answers to common technical queries in the Help Center or reach out directly via our WhatsApp Support Desk.</p>
        
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const manualPath = path.join(candidateDir, 'user-manual.pdf');
  await generatePDF(manualHTML, manualPath);
  generatedAssets.push({ filename: 'user-manual.pdf', user_type: 'candidate', file_path: '/assets/onboarding/candidate/user-manual.pdf' });

  // 3. Candidate Quick Start Guide
  const quickStartHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Platform Onboarding System</div>
        </div>
        <h2 class="title">Getting Started in 5 Minutes</h2>
        <p>Follow these simple steps to kickstart your preparation journey on Futrix:</p>
        <h3>Step 1: Secure Login</h3>
        <p>Sign in using your registered email and password at the student portal login page.</p>
        <h3>Step 2: Complete Profile</h3>
        <p>Complete your profile information, setting your qualification and target competitive exam category.</p>
        <h3>Step 3: Attempt First Test</h3>
        <p>Go to "Active Exams", select any practice series, and attempt your first short daily test.</p>
        <h3>Step 4: View Analytics</h3>
        <p>Analyze your score and subject accuracy report immediately after submitting the test.</p>
        <h3>Step 5: Revise with Memory Lab</h3>
        <p>Explore the Memory Lab to revise incorrect responses using our Spaced Repetition algorithms.</p>
        <h3>Step 6: Join the Community</h3>
        <p>Click the WhatsApp button to join our active candidate community for study updates.</p>
        <a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" class="cta-button">Join WhatsApp Community</a>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const quickStartPath = path.join(candidateDir, 'quick-start.pdf');
  await generatePDF(quickStartHTML, quickStartPath);
  generatedAssets.push({ filename: 'quick-start.pdf', user_type: 'candidate', file_path: '/assets/onboarding/candidate/quick-start.pdf' });

  // 4. Platform Rules
  const rulesHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Platform Onboarding System</div>
        </div>
        <h2 class="title">Platform Rules & Regulations</h2>
        <h3>1. Academic Integrity</h3>
        <p>All candidates must attempt mock tests and examinations honestly without external assistance. Attempting tests using automated scripts, AI helpers, or second browsers is strictly forbidden.</p>
        <h3>2. Fair Usage</h3>
        <p>Multiple account registrations per user to game referral XP points or leaderboards will result in immediate suspension of all associated accounts.</p>
        <h3>3. Account Security</h3>
        <p>Candidates are solely responsible for keeping their login credentials secure. Shared accounts are strictly prohibited and flagged by our security monitoring algorithms.</p>
        <h3>4. Cheating & Suspension Policy</h3>
        <p>Any detected malpractice during proctored examinations will result in a 0-score mark, loss of accrued XP points, and possible temporary or permanent account suspension.</p>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const rulesPath = path.join(candidateDir, 'rules.pdf');
  await generatePDF(rulesHTML, rulesPath);
  generatedAssets.push({ filename: 'rules.pdf', user_type: 'candidate', file_path: '/assets/onboarding/candidate/rules.pdf' });

  // 5. Privacy Policy
  const privacyHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Platform Onboarding System</div>
        </div>
        <h2 class="title">Privacy Policy</h2>
        <p>Last updated: July 2026</p>
        <h3>1. Information We Collect</h3>
        <p>We collect registration details (name, email, phone number, date of birth) and test performance history to provide customized analytics and educational recommendations.</p>
        <h3>2. Data Security</h3>
        <p>We implement state-of-the-art database encryption and RLS (Row Level Security) protocols to ensure your personal data is protected against unauthorized access.</p>
        <h3>3. Sharing & Disclosures</h3>
        <p>Futrix will never sell or disclose your private user data to third-party advertising companies. Your details are used solely to run study and examination reports.</p>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const privacyPath = path.join(candidateDir, 'privacy-policy.pdf');
  await generatePDF(privacyHTML, privacyPath);
  generatedAssets.push({ filename: 'privacy-policy.pdf', user_type: 'candidate', file_path: '/assets/onboarding/candidate/privacy-policy.pdf' });

  // 6. Terms & Conditions
  const termsHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Platform Onboarding System</div>
        </div>
        <h2 class="title">Terms & Conditions</h2>
        <p>Last updated: July 2026</p>
        <h3>1. License to Use</h3>
        <p>Futrix grants you a non-transferable, personal license to access preparation resources and examination systems solely for study purposes.</p>
        <h3>2. Prohibited Conduct</h3>
        <p>You agree not to modify, reverse-engineer, scrape, or copy examination questions, platform layouts, or underlying source code of the Futrix system.</p>
        <h3>3. Subscriptions & Refunds</h3>
        <p>Subscription fees for premium PRO features are charged in advance and are non-refundable after accessing proctoring mock exams.</p>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const termsPath = path.join(candidateDir, 'terms.pdf');
  await generatePDF(termsHTML, termsPath);
  generatedAssets.push({ filename: 'terms.pdf', user_type: 'candidate', file_path: '/assets/onboarding/candidate/terms.pdf' });

  // 7. Contact & Support
  const contactHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Platform Onboarding System</div>
        </div>
        <h2 class="title">Contact & Support</h2>
        <p>Get in touch with the support team for billing, technical, or academic queries:</p>
        <h3>1. General Helpdesk</h3>
        <p>Email: <a href="mailto:support@futrix.com" style="color:var(--primary)">support@futrix.com</a></p>
        <p>WhatsApp Support Desk: <a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" style="color:var(--primary)">Click here to connect</a></p>
        <h3>2. Help Center Office Hours</h3>
        <p>Monday to Saturday: 9:00 AM – 6:00 PM IST</p>
        <p>Technical support for active live tests is available 24/7 during test windows.</p>
        <h3>3. Bug Reporting & Feedback</h3>
        <p>Report issues or suggest platform improvements directly in your Dashboard Settings panel.</p>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const contactPath = path.join(candidateDir, 'contact.pdf');
  await generatePDF(contactHTML, contactPath);
  generatedAssets.push({ filename: 'contact.pdf', user_type: 'candidate', file_path: '/assets/onboarding/candidate/contact.pdf' });

  // 8. Official Social Links
  const socialLinksHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Platform Onboarding System</div>
        </div>
        <h2 class="title">Official Social Links</h2>
        <p>Follow our social channels to get instant updates on competitive exams, memory hacks, and premium prep schedules:</p>
        <h3>Instagram</h3>
        <p><a href="https://www.instagram.com/futrix_official/" style="color:var(--primary)">instagram.com/futrix_official/</a></p>
        <h3>Facebook</h3>
        <p><a href="https://www.facebook.com/profile.php?id=61590709965442" style="color:var(--primary)">facebook.com/futrix</a></p>
        <h3>WhatsApp Community</h3>
        <p><a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" style="color:var(--primary)">chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc</a></p>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const socialLinksPath = path.join(candidateDir, 'social-links.pdf');
  await generatePDF(socialLinksHTML, socialLinksPath);
  generatedAssets.push({ filename: 'social-links.pdf', user_type: 'candidate', file_path: '/assets/onboarding/candidate/social-links.pdf' });

  // 9. Start Your First Test
  const startTestHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card" style="text-align:center;">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Platform Onboarding System</div>
        </div>
        <h2 class="title">Start Your First Test!</h2>
        <p>Ready to evaluate your skills? Dive straight into the exam arena and earn your first points!</p>
        <div style="margin: 30px auto; max-width: 250px; padding: 20px; background: rgba(56, 189, 248, 0.05); border: 1px dashed var(--primary); border-radius: 16px;">
          <span style="font-size: 48px;">🏆</span>
          <div style="font-size: 14px; font-weight:700; color:var(--primary); margin-top:10px;">+100 XP REGISTRATION REWARD</div>
        </div>
        <p>Earn additional bonus XP on first submission.</p>
        <a href="http://localhost:8000/active-exams.html" class="cta-button">🚀 Start First Test Now</a>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const startTestPath = path.join(candidateDir, 'first-test.pdf');
  await generatePDF(startTestHTML, startTestPath);
  generatedAssets.push({ filename: 'first-test.pdf', user_type: 'candidate', file_path: '/assets/onboarding/candidate/first-test.pdf' });

  // 10. Candidate Presentation Slide PDF
  const candidateSlidesHTML = `
    <!DOCTYPE html>
    <html>
    <head>${LANDSCAPE_STYLE}</head>
    <body>
      <!-- Slide 1 -->
      <div class="slide">
        <div>
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div style="font-size: 11px; text-transform:uppercase; color:var(--secondary); letter-spacing:2px; margin-top:5px;">Candidate Orientation Manual</div>
        </div>
        <div style="margin: auto 0; text-align:center;">
          <h2 class="slide-title">Welcome Competitor!</h2>
          <p>This presentation will guide you through our core prep systems in under 2 minutes.</p>
        </div>
        <div class="slide-footer">
          <span>Futrix Systems</span>
          <span>Slide 1 of 4</span>
        </div>
      </div>

      <!-- Slide 2 -->
      <div class="slide">
        <h2 class="slide-title">1. The Command Center Dashboard</h2>
        <div class="slide-content">
          <p>Your dashboard gives you direct access to:</p>
          <ul>
            <li><strong>Active Exams:</strong> Full length mock exams and short daily evaluation test series.</li>
            <li><strong>Memory Lab:</strong> SRS system scheduling review cards for your incorrect answers.</li>
            <li><strong>XP Streaks:</strong> Retain daily streaks to double test completion reward scores.</li>
          </ul>
        </div>
        <div class="slide-footer">
          <span>Futrix Systems</span>
          <span>Slide 2 of 4</span>
        </div>
      </div>

      <!-- Slide 3 -->
      <div class="slide">
        <h2 class="slide-title">2. Gamified Leagues & Rewards</h2>
        <div class="slide-content">
          <p>Gain XP for every learning action on the portal:</p>
          <ul>
            <li>Test completion reward points.</li>
            <li>10 XP bonus points credited for verified student referral registrations.</li>
            <li>Qualify for Bronze, Silver, Gold and Diamond global league brackets.</li>
          </ul>
        </div>
        <div class="slide-footer">
          <span>Futrix Systems</span>
          <span>Slide 3 of 4</span>
        </div>
      </div>

      <!-- Slide 4 -->
      <div class="slide">
        <h2 class="slide-title">3. Support & Community Desk</h2>
        <div class="slide-content">
          <p>We are always here to help you:</p>
          <ul>
            <li>Join our official WhatsApp group for daily peer discussion and revision decks.</li>
            <li>Reach general query helpdesk at <strong>support@futrix.com</strong>.</li>
          </ul>
        </div>
        <div class="slide-footer">
          <span>Futrix Systems</span>
          <span>Slide 4 of 4</span>
        </div>
      </div>
    </body>
    </html>
  `;
  const candidateSlidesPath = path.join(pptDir, 'candidate-presentation.pdf');
  await generatePDF(candidateSlidesHTML, candidateSlidesPath, true);
  generatedAssets.push({ filename: 'candidate-presentation.pdf', user_type: 'candidate', file_path: '/assets/onboarding/ppt/candidate-presentation.pdf' });


  // ==================== TEACHER DOCUMENTS ====================

  // 1. Teacher Welcome Letter
  const teacherWelcomeHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Educator Onboarding System</div>
        </div>
        <div class="meta-box">
          <div class="meta-grid">
            <div><span class="meta-label">Document:</span> Welcome Letter</div>
            <div><span class="meta-label">Version:</span> 1.0.0</div>
            <div><span class="meta-label">Authorized For:</span> Verified Educator</div>
            <div><span class="meta-label">Date:</span> July 2026</div>
          </div>
        </div>
        <h2 class="title">Welcome, Educator!</h2>
        <p>Dear Educator,</p>
        <p>It is an honor to welcome you to the Futrix Educator Portal! As a teacher on Futrix, you have access to industry-grade tools designed to simplify test creation, class management, and candidate performance analysis.</p>
        <p>Our platform enables you to author custom assessments, manage class cohorts, and access deep AI analytics reporting on student strengths and mistakes.</p>
        <p>Enclosed in this Welcome Kit are the Teacher User Manual, Quick Start Guide, and Platform Guidelines. We look forward to working together to enhance learning outcomes.</p>
        <br>
        <p>Best regards,</p>
        <p><strong>The Futrix Team</strong></p>
        <a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" class="cta-button">Join WhatsApp Community</a>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const teacherWelcomePath = path.join(teacherDir, 'welcome-letter.pdf');
  await generatePDF(teacherWelcomeHTML, teacherWelcomePath);
  generatedAssets.push({ filename: 'welcome-letter.pdf', user_type: 'teacher', file_path: '/assets/onboarding/teacher/welcome-letter.pdf' });

  // 2. Teacher User Manual
  const teacherManualHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Educator Onboarding System</div>
        </div>
        <h2 class="title">Teacher User Manual</h2>
        <h3>Table of Contents</h3>
        <ol>
          <li>Teacher Dashboard Overview</li>
          <li>Test Authoring & Question Bank</li>
          <li>Classroom Management</li>
          <li>Student Performance Analytics</li>
          <li>FAQs & Support Desk</li>
        </ol>

        <div class="page-break"></div>
        <h3>1. Teacher Dashboard</h3>
        <p>The Teacher Dashboard displays active class stats, pending question approvals, upcoming test schedules, and fast navigation to analytical tools.</p>

        <h3>2. Test Authoring & Question Bank</h3>
        <p>Easily create mock tests using our global Question Bank or author your own questions. Filter questions by subject, target exam type, and difficulty level.</p>

        <h3>3. Classroom Management</h3>
        <p>Organize students into class batches. Track registration verification codes, profiles, and attendance details.</p>

        <h3>4. Student Performance Analytics</h3>
        <p>Access high-fidelity class performance reports. Review common error clusters and average time-spent indexes to tailor your teaching strategies.</p>

        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const teacherManualPath = path.join(teacherDir, 'user-manual.pdf');
  await generatePDF(teacherManualHTML, teacherManualPath);
  generatedAssets.push({ filename: 'user-manual.pdf', user_type: 'teacher', file_path: '/assets/onboarding/teacher/user-manual.pdf' });

  // 3. Teacher Quick Start
  const teacherQuickStartHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Educator Onboarding System</div>
        </div>
        <h2 class="title">Getting Started in 5 Minutes</h2>
        <h3>Step 1: Educator Login</h3>
        <p>Log in using your registered credentials at the administrator panel portal.</p>
        <h3>Step 2: Classroom Batch setup</h3>
        <p>Create your first classroom cohort and invite students using invitation links.</p>
        <h3>Step 3: Author First Test</h3>
        <p>Go to test manager, select "Create New Test", select questions, and schedule the exam.</p>
        <h3>Step 4: View Results</h3>
        <p>Once students submit, download the student score reports from the analytics tab.</p>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const teacherQuickStartPath = path.join(teacherDir, 'quick-start.pdf');
  await generatePDF(teacherQuickStartHTML, teacherQuickStartPath);
  generatedAssets.push({ filename: 'quick-start.pdf', user_type: 'teacher', file_path: '/assets/onboarding/teacher/quick-start.pdf' });

  // 4. Teacher Rules
  const teacherRulesHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Educator Onboarding System</div>
        </div>
        <h2 class="title">Educator Rules & Guidelines</h2>
        <h3>1. Content Quality</h3>
        <p>Questions authored must contain correct options and accurate explanatory rationales. Plagiarism or copyright violations in exam questions will result in panel revoking.</p>
        <h3>2. Grading Practices</h3>
        <p>Subjective question checking must remain transparent, unbiased, and within specified evaluation windows.</p>
        <h3>3. Data Confidentiality</h3>
        <p>Student email, phone, and grade histories are strictly private. Sharing student sheets is a violation of platform guidelines.</p>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const teacherRulesPath = path.join(teacherDir, 'rules.pdf');
  await generatePDF(teacherRulesHTML, teacherRulesPath);
  generatedAssets.push({ filename: 'rules.pdf', user_type: 'teacher', file_path: '/assets/onboarding/teacher/rules.pdf' });

  // 5. Teacher Contact Info
  const teacherContactHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Educator Onboarding System</div>
        </div>
        <h2 class="title">Educator Support Contacts</h2>
        <h3>1. Technical Help Desk</h3>
        <p>Email: <a href="mailto:educator-support@futrix.com" style="color:var(--primary)">educator-support@futrix.com</a></p>
        <h3>2. Social Channels</h3>
        <p>WhatsApp Community: <a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" style="color:var(--primary)">Join WhatsApp Group</a></p>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const teacherContactPath = path.join(teacherDir, 'contact.pdf');
  await generatePDF(teacherContactHTML, teacherContactPath);
  generatedAssets.push({ filename: 'contact.pdf', user_type: 'teacher', file_path: '/assets/onboarding/teacher/contact.pdf' });

  // 6. Teacher Social Links
  const teacherSocialLinksHTML = `
    <!DOCTYPE html>
    <html>
    <head>${BRAND_STYLE}</head>
    <body>
      <div class="document-card">
        <div class="header">
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div class="subtitle">Educator Onboarding System</div>
        </div>
        <h2 class="title">Official Social Links</h2>
        <p>Stay connected with other educators and platform coordinators:</p>
        <h3>WhatsApp Community</h3>
        <p><a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" style="color:var(--primary)">chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc</a></p>
        <h3>Instagram</h3>
        <p><a href="https://www.instagram.com/futrix_official/" style="color:var(--primary)">instagram.com/futrix_official/</a></p>
        <h3>Facebook</h3>
        <p><a href="https://www.facebook.com/profile.php?id=61590709965442" style="color:var(--primary)">facebook.com/futrix</a></p>
        <div class="footer">&copy; 2026 Futrix System Intelligence. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
  const teacherSocialLinksPath = path.join(teacherDir, 'social-links.pdf');
  await generatePDF(teacherSocialLinksHTML, teacherSocialLinksPath);
  generatedAssets.push({ filename: 'social-links.pdf', user_type: 'teacher', file_path: '/assets/onboarding/teacher/social-links.pdf' });

  // 7. Teacher Presentation Slide PDF
  const teacherSlidesHTML = `
    <!DOCTYPE html>
    <html>
    <head>${LANDSCAPE_STYLE}</head>
    <body>
      <!-- Slide 1 -->
      <div class="slide">
        <div>
          <div class="logo"><span class="white">Fut</span><span class="cyan">rix</span></div>
          <div style="font-size: 11px; text-transform:uppercase; color:var(--secondary); letter-spacing:2px; margin-top:5px;">Educator Orientation Manual</div>
        </div>
        <div style="margin: auto 0; text-align:center;">
          <h2 class="slide-title">Welcome Educator!</h2>
          <p>This presentation highlights the classroom and test authoring tools available to you on Futrix.</p>
        </div>
        <div class="slide-footer">
          <span>Futrix Systems</span>
          <span>Slide 1 of 3</span>
        </div>
      </div>

      <!-- Slide 2 -->
      <div class="slide">
        <h2 class="slide-title">1. Test Creation & Scheduling</h2>
        <div class="slide-content">
          <p>Create dynamic assessments in under 2 minutes:</p>
          <ul>
            <li>Select questions from the global verified repository.</li>
            <li>Custom grade weights and time duration settings.</li>
            <li>Release results immediately or at a scheduled target date.</li>
          </ul>
        </div>
        <div class="slide-footer">
          <span>Futrix Systems</span>
          <span>Slide 2 of 3</span>
        </div>
      </div>

      <!-- Slide 3 -->
      <div class="slide">
        <h2 class="slide-title">2. Class Performance Reports</h2>
        <div class="slide-content">
          <p>Get deep analytical insight on student accuracy indexes:</p>
          <ul>
            <li>Accuracy clusters per topic.</li>
            <li>Average time-spent index per question.</li>
            <li>Detailed grade export to Excel/CSV.</li>
          </ul>
        </div>
        <div class="slide-footer">
          <span>Futrix Systems</span>
          <span>Slide 3 of 3</span>
        </div>
      </div>
    </body>
    </html>
  `;
  const teacherSlidesPath = path.join(pptDir, 'teacher-presentation.pdf');
  await generatePDF(teacherSlidesHTML, teacherSlidesPath, true);
  generatedAssets.push({ filename: 'teacher-presentation.pdf', user_type: 'teacher', file_path: '/assets/onboarding/ppt/teacher-presentation.pdf' });

  // Sync to database
  console.log("Syncing generated assets to public.onboarding_assets table...");
  const client = new Client(dbConfig);
  await client.connect();

  for (const asset of generatedAssets) {
    try {
      await client.query(`
        INSERT INTO public.onboarding_assets (filename, user_type, version, file_path, status)
        VALUES ($1, $2, '1.0.0', $3, 'published')
        ON CONFLICT (filename) 
        DO UPDATE SET file_path = EXCLUDED.file_path, updated_at = NOW();
      `, [asset.filename, asset.user_type, asset.file_path]);
      console.log(`- Database synced for: ${asset.filename} (${asset.user_type})`);
    } catch (err) {
      console.error(`- Database sync error for ${asset.filename}:`, err.message);
    }
  }

  await client.end();
  console.log("Onboarding welcome kit generation completed successfully!");
}

main().catch(console.error);
