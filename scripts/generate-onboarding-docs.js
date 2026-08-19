const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const CANDIDATE_DIR = path.join(__dirname, '../assets/onboarding/candidate');
const CANDIDATE_PPT_DIR = path.join(CANDIDATE_DIR, 'ppt');
const TEACHER_DIR = path.join(__dirname, '../assets/onboarding/teacher');
const TEACHER_PPT_DIR = path.join(TEACHER_DIR, 'ppt');

// Ensure directories exist
[CANDIDATE_DIR, CANDIDATE_PPT_DIR, TEACHER_DIR, TEACHER_PPT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const commonStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Geist:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Geist', sans-serif;
    background: #090b11;
    color: #f3f4f6;
    padding: 2.5rem;
    line-height: 1.6;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid rgba(56, 189, 248, 0.3);
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
  }
  .brand {
    font-family: 'Sora', sans-serif;
    font-size: 2.2rem;
    font-weight: 800;
    color: #fff;
  }
  .brand span { color: #38bdf8; }
  .badge {
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #38bdf8;
    padding: 0.4rem 1rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  h1 { font-family: 'Sora', sans-serif; font-size: 1.8rem; font-weight: 800; color: #fff; margin-bottom: 1rem; }
  h2 { font-family: 'Sora', sans-serif; font-size: 1.3rem; font-weight: 700; color: #38bdf8; margin: 1.5rem 0 0.75rem 0; }
  p { font-size: 0.95rem; color: #cbd5e1; margin-bottom: 1rem; }
  ul { margin-left: 1.5rem; margin-bottom: 1.5rem; color: #cbd5e1; }
  li { margin-bottom: 0.5rem; }
  .card {
    background: #121526;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .cta-btn {
    display: inline-block;
    background: linear-gradient(135deg, #4d8eff, #38bdf8);
    color: #fff;
    font-family: 'Sora', sans-serif;
    font-weight: 700;
    padding: 0.8rem 1.8rem;
    border-radius: 10px;
    text-decoration: none;
    font-size: 0.95rem;
    margin-top: 1rem;
  }
  .footer {
    margin-top: 3rem;
    border-top: 1px solid rgba(255,255,255,0.08);
    padding-top: 1.5rem;
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: #64748b;
  }
`;

const htmlTemplates = {
  // CANDIDATE DOCUMENTS
  candidateWelcomeLetter: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Official Welcome Letter</div>
      </div>
      <h1>Welcome to FUTRIX, Champion! 🎉</h1>
      <p>Dear Candidate,</p>
      <p>We are beyond excited to welcome you to <strong>FUTRIX</strong> — the next-generation cognitive learning platform built to supercharge your exam preparation and unlock your highest academic potential.</p>
      <div class="card">
        <h2>🚀 What Awaits You at FUTRIX:</h2>
        <ul>
          <li><strong>Daily Practice Tests & Full Mock Series:</strong> Crafted according to exact exam patterns.</li>
          <li><strong>Memory Lab & Smart Spaced Repetition:</strong> Turn your mistakes into long-term strengths automatically.</li>
          <li><strong>Real-Time XP & Gamified Leagues:</strong> Compete on national leaderboards and earn cognitive rewards.</li>
          <li><strong>AI Performance Analytics:</strong> Instant speed, accuracy, and subject mastery breakdown.</li>
        </ul>
      </div>
      <p>Explore your candidate welcome kit included in this folder. It contains your complete User Manual, Exam Guidelines, and Quick Start Guide.</p>
      <div style="text-align:center; margin-top:2rem;">
        <a class="cta-btn" href="http://localhost:8000/active-exams.html">Start Your Learning Journey Now</a>
      </div>
      <div class="footer">
        <div>FUTRIX System Intelligence &copy; 2026</div>
        <div>Doc Ver: 1.0.4 | Revision 2026.A</div>
      </div>
    </body></html>
  `,

  candidateQuickStart: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Getting Started in 5 Minutes</div>
      </div>
      <h1>⚡ Candidate Quick Start Guide</h1>
      <div class="card">
        <h2>Step 1: Complete Your Profile</h2>
        <p>Log in and ensure your exam target (NEET / JEE / Foundation) and contact information are updated.</p>
      </div>
      <div class="card">
        <h2>Step 2: Attempt Your First Test</h2>
        <p>Head to the <strong>Active Test Series</strong> panel and click <em>Attempt Test</em> to test your speed and accuracy.</p>
      </div>
      <div class="card">
        <h2>Step 3: Review Mistakes in Memory Lab</h2>
        <p>Questions answered incorrectly are saved to your Memory Lab for spaced flashcard revision.</p>
      </div>
      <div class="card">
        <h2>Step 4: Track XP & Climb Leaderboards</h2>
        <p>Earn XP points for every test completed and level up on the national student leaderboard.</p>
      </div>
      <div class="footer">
        <div>FUTRIX Learning Systems &copy; 2026</div>
        <div>Quick Start Guide v1.0</div>
      </div>
    </body></html>
  `,

  candidateUserManual: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Candidate User Manual (Complete Guide)</div>
      </div>
      <h1>📖 FUTRIX Comprehensive Candidate Manual</h1>
      <p>Version 2.4 | Official Student Product Guide</p>

      <h2>1. Introduction to FUTRIX</h2>
      <p>FUTRIX is an enterprise cognitive platform designed for competitive exam aspirants. It integrates automated test series, AI analytics, and spaced-repetition flashcards.</p>

      <h2>2. Account Management & Security</h2>
      <p>Your account is protected via Email OTP and browser device fingerprinting. Ensure your login email and guardian phone number are accurate in Settings.</p>

      <h2>3. Taking Tests & Exam Environment</h2>
      <p>Tests are delivered in an anti-cheat secure sandbox. Tab switching or window minimization during an active test will flag your suspicion score.</p>

      <h2>4. Memory Lab & Cognitive Spaced Repetition</h2>
      <p>Memory Lab automatically organizes missed questions into interactive flashcards scheduled at 1-day, 3-day, and 7-day intervals for max retention.</p>

      <h2>5. XP Balance & Gamified Leagues</h2>
      <p>Earn XP based on accuracy and speed. Climb through Bronze, Silver, Gold, Platinum, and Diamond leagues each month.</p>

      <div class="footer">
        <div>FUTRIX System Intelligence &copy; 2026</div>
        <div>Page 1 of User Manual | Ver 2.4</div>
      </div>
    </body></html>
  `,

  candidateRules: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Platform Rules & Cheating Policy</div>
      </div>
      <h1>🛡️ FUTRIX Platform Rules & Academic Integrity</h1>
      <div class="card">
        <h2>1. Academic Honesty Policy</h2>
        <p>All tests must be attempted independently without secondary device usage, external assistance, or unauthorized browser tab switching.</p>
      </div>
      <div class="card">
        <h2>2. Anti-Cheat Monitoring</h2>
        <p>FUTRIX records tab focus loss, device orientation changes, and submission latencies. Flagged accounts risk automated score disqualification.</p>
      </div>
      <div class="card">
        <h2>3. Fair Usage & Account Sharing</h2>
        <p>Sharing candidate credentials across multiple individuals is strictly prohibited and subject to account suspension.</p>
      </div>
      <div class="footer">
        <div>FUTRIX Legal & Compliance &copy; 2026</div>
        <div>Rules & Policies Ver 1.2</div>
      </div>
    </body></html>
  `,

  candidateExamGuidelines: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Exam Guidelines</div>
      </div>
      <h1>📝 Exam Guidelines & Technical Requirements</h1>
      <h2>Before the Test:</h2>
      <ul>
        <li>Ensure a stable internet connection (minimum 2 Mbps recommended).</li>
        <li>Use Chrome, Edge, or Safari browser updated to the latest version.</li>
        <li>Close background downloads or video streams.</li>
      </ul>
      <h2>During the Test:</h2>
      <ul>
        <li>Do not refresh or switch browser tabs during active testing.</li>
        <li>Use the <strong>Mark for Review</strong> button for difficult questions.</li>
        <li>Submit before the timer reaches 00:00.</li>
      </ul>
      <div class="footer">
        <div>FUTRIX Examination Board &copy; 2026</div>
        <div>Exam Rules Ver 1.0</div>
      </div>
    </body></html>
  `,

  candidatePrivacyPolicy: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Privacy Policy</div>
      </div>
      <h1>🔒 Privacy Policy & Data Security</h1>
      <p>At FUTRIX, we respect your privacy. This policy outlines how candidate data, email logs, and test performance metrics are encrypted and safely stored.</p>
      <h2>Data Encryption</h2>
      <p>All network data is transmitted over HTTPS with TLS 1.3 encryption. Profile information is stored securely in encrypted Supabase database tables.</p>
      <div class="footer">
        <div>FUTRIX Privacy & Security &copy; 2026</div>
        <div>Privacy Ver 1.1</div>
      </div>
    </body></html>
  `,

  candidateTerms: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Terms & Conditions</div>
      </div>
      <h1>📜 Terms & Conditions of Service</h1>
      <p>By registering a Candidate Account on FUTRIX, you agree to comply with our platform terms of service, acceptable use guidelines, and test series access policies.</p>
      <div class="footer">
        <div>FUTRIX Legal &copy; 2026</div>
        <div>Terms Ver 1.0</div>
      </div>
    </body></html>
  `,

  candidateContact: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Support & Contact Directory</div>
      </div>
      <h1>📞 FUTRIX Candidate Help & Support</h1>
      <div class="card">
        <h2>Email Support</h2>
        <p>Email: <strong style="color:#fff">teamfutrix@gmail.com</strong> / <strong style="color:#fff">support@futrix.com</strong></p>
      </div>
      <div class="card">
        <h2>WhatsApp Community & Live Support</h2>
        <p>Join our official WhatsApp group for daily study materials and instant updates.</p>
        <a class="cta-btn" href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc">Join WhatsApp Community</a>
      </div>
      <div class="footer">
        <div>FUTRIX Support Desk &copy; 2026</div>
        <div>Support Directory v1.0</div>
      </div>
    </body></html>
  `,

  candidateSocialLinks: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Official Social Links</div>
      </div>
      <h1>🌐 Connect With FUTRIX Across Channels</h1>
      <div class="card">
        <ul>
          <li><strong>Instagram:</strong> @futrix_official</li>
          <li><strong>Facebook:</strong> FUTRIX Official Portal</li>
          <li><strong>WhatsApp Group:</strong> Official FUTRIX Aspirants Community</li>
        </ul>
      </div>
      <div class="footer">
        <div>FUTRIX Community Relations &copy; 2026</div>
      </div>
    </body></html>
  `,

  candidateFirstTest: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Start First Test</div>
      </div>
      <h1 style="font-size:2.4rem; text-align:center; margin-top:2rem;">Ready to Test Your Knowledge? 🚀</h1>
      <p style="text-align:center; font-size:1.1rem;">Click below to launch your first instant mock diagnostic evaluation.</p>
      <div style="text-align:center; margin-top:3rem;">
        <a class="cta-btn" style="font-size:1.2rem; padding:1.2rem 3rem;" href="http://localhost:8000/active-exams.html">Start First Test Now</a>
      </div>
      <div class="footer">
        <div>FUTRIX Diagnostic Testing &copy; 2026</div>
      </div>
    </body></html>
  `,

  candidatePresentation: `
    <!DOCTYPE html><html><head><style>${commonStyles} body { padding: 4rem; } .header { border:none; }</style></head><body>
      <div class="header">
        <div class="brand" style="font-size:3rem;">Fut<span>rix</span></div>
        <div class="badge" style="font-size:1rem;">Candidate Orientation Slide Deck</div>
      </div>
      <h1 style="font-size:2.8rem; margin-top:2rem;">Master Your Competitive Exams with FUTRIX</h1>
      <p style="font-size:1.2rem; margin-top:1rem;">An Enterprise Cognitive Learning & Assessment Ecosystem</p>
      <div class="footer" style="margin-top:8rem;">
        <div>Presentation Deck 2026.A</div>
      </div>
    </body></html>
  `,

  // TEACHER DOCUMENTS
  teacherWelcomeLetter: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Educator Welcome Letter</div>
      </div>
      <h1>Welcome to FUTRIX Educator Portal 🎓</h1>
      <p>Dear Educator,</p>
      <p>Welcome to the official <strong>FUTRIX Teacher & Educator Portal</strong>. We are honored to partner with you in shaping academic excellence and guiding students toward success.</p>
      <div class="card">
        <h2>🛠️ Your Educator Suite Tools:</h2>
        <ul>
          <li><strong>Smart Test Builder (STB):</strong> Create automated chapterwise tests in seconds.</li>
          <li><strong>Enterprise Question Bank:</strong> Access thousands of verified NCERT & entrance exam questions.</li>
          <li><strong>Student Performance Analytics:</strong> Track class accuracy, subject gaps, and time distribution.</li>
          <li><strong>QA & Approvals Console:</strong> Author and review high-yield questions for your students.</li>
        </ul>
      </div>
      <p>Your Teacher Welcome Kit included in this directory contains your Educator Manual, Quick Start Guide, and Best Practices.</p>
      <div class="footer">
        <div>FUTRIX Educator Network &copy; 2026</div>
        <div>Teacher Doc Ver 1.0</div>
      </div>
    </body></html>
  `,

  teacherUserManual: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Teacher User Manual</div>
      </div>
      <h1>📖 FUTRIX Educator Operating Manual</h1>
      <h2>1. Overview of Educator Console</h2>
      <p>The Teacher Console empowers educators to create customized tests, analyze student Cohort metrics, and assign automated practice decks.</p>
      <h2>2. Creating & Publishing Tests</h2>
      <p>Use the Smart Test Builder to set question counts, marking schemes (+4/-1), and exam durations (e.g. 180 mins).</p>
      <h2>3. Analytics & Class Reports</h2>
      <p>Export class rank lists and detailed question-by-question error distribution charts.</p>
      <div class="footer">
        <div>FUTRIX Educator Operations &copy; 2026</div>
        <div>Teacher Manual Ver 2.0</div>
      </div>
    </body></html>
  `,

  teacherQuickStart: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Teacher Quick Start Guide</div>
      </div>
      <h1>⚡ Educator Quick Start Guide</h1>
      <div class="card">
        <h2>Step 1: Access Teacher Dashboard</h2>
        <p>Log in with your verified Educator account to access the Educator Portal.</p>
      </div>
      <div class="card">
        <h2>Step 2: Create Your First Test</h2>
        <p>Use <strong>Smart Test Builder</strong> to select subjects, chapters, and generate a customized mock exam.</p>
      </div>
      <div class="card">
        <h2>Step 3: Track Class Performance</h2>
        <p>View real-time student submissions, score distributions, and topic mastery ratings.</p>
      </div>
      <div class="footer">
        <div>FUTRIX Educator Support &copy; 2026</div>
      </div>
    </body></html>
  `,

  teacherGuidelines: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Educator Guidelines & Best Practices</div>
      </div>
      <h1>🎓 Educator Quality Guidelines & Best Practices</h1>
      <p>Ensure all authored questions match NTA/NCERT exam standards. Include step-by-step solution explanations for student review.</p>
      <div class="footer">
        <div>FUTRIX Academic Quality Board &copy; 2026</div>
      </div>
    </body></html>
  `,

  teacherRules: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Platform Rules</div>
      </div>
      <h1>🛡️ Educator Code of Conduct & Platform Rules</h1>
      <p>Maintain academic integrity, respect student privacy, and protect proprietary question bank content.</p>
      <div class="footer">
        <div>FUTRIX Compliance &copy; 2026</div>
      </div>
    </body></html>
  `,

  teacherPrivacyPolicy: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Privacy Policy</div>
      </div>
      <h1>🔒 Educator Data Privacy Policy</h1>
      <p>Your educator records and authored materials are encrypted and protected under FUTRIX enterprise privacy standards.</p>
      <div class="footer">
        <div>FUTRIX Security &copy; 2026</div>
      </div>
    </body></html>
  `,

  teacherTerms: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Terms & Conditions</div>
      </div>
      <h1>📜 Educator Terms of Service</h1>
      <p>Terms and conditions governing Teacher Console access, content creation, and institutional management.</p>
      <div class="footer">
        <div>FUTRIX Legal &copy; 2026</div>
      </div>
    </body></html>
  `,

  teacherContact: `
    <!DOCTYPE html><html><head><style>${commonStyles}</style></head><body>
      <div class="header">
        <div class="brand">Fut<span>rix</span></div>
        <div class="badge">Contact Support</div>
      </div>
      <h1>📞 Dedicated Educator Helpdesk</h1>
      <p>Email: <strong style="color:#fff">teamfutrix@gmail.com</strong></p>
      <p>WhatsApp Educator Hotline: Join our official educator network for priority assistance.</p>
      <div class="footer">
        <div>FUTRIX Educator Relations &copy; 2026</div>
      </div>
    </body></html>
  `,

  teacherPresentation: `
    <!DOCTYPE html><html><head><style>${commonStyles} body { padding: 4rem; } .header { border:none; }</style></head><body>
      <div class="header">
        <div class="brand" style="font-size:3rem;">Fut<span>rix</span></div>
        <div class="badge" style="font-size:1rem;">Educator Orientation Deck</div>
      </div>
      <h1 style="font-size:2.8rem; margin-top:2rem;">FUTRIX Educator Portal & Analytics Suite</h1>
      <p style="font-size:1.2rem; margin-top:1rem;">Empowering Teachers with AI-Powered Test Building & Analytics</p>
      <div class="footer" style="margin-top:8rem;">
        <div>Educator Presentation Deck 2026.A</div>
      </div>
    </body></html>
  `
};

async function generateAllDocs() {
  console.log('[ASSET GENERATOR] Launching Puppeteer to generate Onboarding PDFs & PPTs...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const docsToGenerate = [
    // CANDIDATE DOCS
    { html: htmlTemplates.candidateWelcomeLetter, dest: path.join(CANDIDATE_DIR, 'welcome-letter.pdf') },
    { html: htmlTemplates.candidateUserManual, dest: path.join(CANDIDATE_DIR, 'user-manual.pdf') },
    { html: htmlTemplates.candidateQuickStart, dest: path.join(CANDIDATE_DIR, 'quick-start.pdf') },
    { html: htmlTemplates.candidateRules, dest: path.join(CANDIDATE_DIR, 'rules.pdf') },
    { html: htmlTemplates.candidateExamGuidelines, dest: path.join(CANDIDATE_DIR, 'exam-guidelines.pdf') },
    { html: htmlTemplates.candidatePrivacyPolicy, dest: path.join(CANDIDATE_DIR, 'privacy-policy.pdf') },
    { html: htmlTemplates.candidateTerms, dest: path.join(CANDIDATE_DIR, 'terms.pdf') },
    { html: htmlTemplates.candidateContact, dest: path.join(CANDIDATE_DIR, 'contact.pdf') },
    { html: htmlTemplates.candidateSocialLinks, dest: path.join(CANDIDATE_DIR, 'social-links.pdf') },
    { html: htmlTemplates.candidateFirstTest, dest: path.join(CANDIDATE_DIR, 'first-test.pdf') },
    { html: htmlTemplates.candidatePresentation, dest: path.join(CANDIDATE_PPT_DIR, 'candidate-presentation.pdf') },

    // TEACHER DOCS
    { html: htmlTemplates.teacherWelcomeLetter, dest: path.join(TEACHER_DIR, 'welcome-letter.pdf') },
    { html: htmlTemplates.teacherUserManual, dest: path.join(TEACHER_DIR, 'user-manual.pdf') },
    { html: htmlTemplates.teacherQuickStart, dest: path.join(TEACHER_DIR, 'quick-start.pdf') },
    { html: htmlTemplates.teacherGuidelines, dest: path.join(TEACHER_DIR, 'teacher-guidelines.pdf') },
    { html: htmlTemplates.teacherRules, dest: path.join(TEACHER_DIR, 'rules.pdf') },
    { html: htmlTemplates.teacherPrivacyPolicy, dest: path.join(TEACHER_DIR, 'privacy-policy.pdf') },
    { html: htmlTemplates.teacherTerms, dest: path.join(TEACHER_DIR, 'terms.pdf') },
    { html: htmlTemplates.teacherContact, dest: path.join(TEACHER_DIR, 'contact.pdf') },
    { html: htmlTemplates.teacherPresentation, dest: path.join(TEACHER_PPT_DIR, 'teacher-presentation.pdf') }
  ];

  for (const item of docsToGenerate) {
    const page = await browser.newPage();
    await page.setContent(item.html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: item.dest,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });
    console.log(`  ✓ Generated: ${path.relative(path.join(__dirname, '..'), item.dest)}`);
    await page.close();
  }

  // Also create placeholder .pptx copies for presentation decks
  fs.copyFileSync(path.join(CANDIDATE_PPT_DIR, 'candidate-presentation.pdf'), path.join(CANDIDATE_PPT_DIR, 'candidate-presentation.pptx'));
  fs.copyFileSync(path.join(TEACHER_PPT_DIR, 'teacher-presentation.pdf'), path.join(TEACHER_PPT_DIR, 'teacher-presentation.pptx'));

  await browser.close();
  console.log('[ASSET GENERATOR] Successfully generated all Candidate & Teacher onboarding documents!');
}

generateAllDocs().catch(err => {
  console.error('[ASSET GENERATOR ERROR]:', err);
  process.exit(1);
});
