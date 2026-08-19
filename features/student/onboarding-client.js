/**
 * FUTRIX Enterprise Onboarding & Welcome Kit Client Helper
 * Dynamically handles Sidebar injection, Download Center Modal, and First-Time Login Tour Wizard.
 */

(function () {
  // Wait for DOM and Supabase Client to be loaded
  window.addEventListener('DOMContentLoaded', async () => {
    // 1. Get user session from sessionStorage
    const userRaw = sessionStorage.getItem('futrix_user');
    if (!userRaw) return;
    const user = JSON.parse(userRaw);
    const role = user.role || 'student';
    const email = user.email || '';

    // Check if account is blocked
    if (email) {
      try {
        const blkRes = await fetch('/api/auth/check-block-status?email=' + encodeURIComponent(email));
        if (blkRes.ok) {
          const blkData = await blkRes.json();
          if (blkData.is_blocked) {
            renderBlockedOverlay(email, blkData.block_reason);
            return;
          }
        }
      } catch (err) {
        console.warn('Block status check error:', err);
      }
    }
    
    // Get access token if available
    let token = '';
    if (role === 'teacher') {
      token = 'mock-teacher-token';
    } else {
      token = 'mock-student-token';
    }
    try {
      if (window.supabase) {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session && session.access_token) {
          token = session.access_token;
        }
      }
    } catch (e) {}

    // 2. Inject CSS for Welcome Kit Modal and Tour Wizard
    injectStyles();

    // 3. Inject "Welcome Kit" link to Sidebar
    injectSidebarLink(role);

    // 4. Inject Welcome Kit Download Modal HTML
    injectDownloadModal(role, email, token);

    // 5. Trigger First Login Onboarding Tour Wizard if not completed
    setTimeout(async () => {
      await checkAndRunOnboardingTour(user, email, token);
    }, 1500);
  });

  // Inject beautiful, modern CSS styles
  function injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      /* Welcome Kit Modal Styles */
      .fxt-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(4, 6, 12, 0.85);
        backdrop-filter: blur(12px);
        z-index: 99999;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .fxt-modal.show {
        display: flex;
        opacity: 1;
      }
      .fxt-modal-container {
        background: #0f172a;
        border: 2px solid #38bdf8;
        box-shadow: 0 0 30px rgba(56, 189, 248, 0.25);
        border-radius: 24px;
        width: 90%;
        max-width: 700px;
        max-height: 85vh;
        overflow-y: auto;
        padding: 35px;
        color: #f0f9ff;
        font-family: 'Plus Jakarta Sans', sans-serif;
        transform: scale(0.9);
        transition: transform 0.3s ease;
      }
      .fxt-modal.show .fxt-modal-container {
        transform: scale(1);
      }
      .fxt-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(56, 189, 248, 0.15);
        padding-bottom: 15px;
        margin-bottom: 25px;
      }
      .fxt-modal-title {
        font-family: 'Outfit', sans-serif;
        font-size: 24px;
        font-weight: 800;
        background: linear-gradient(135deg, #38bdf8, #818cf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .fxt-modal-close {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 24px;
        cursor: pointer;
        transition: color 0.2s;
      }
      .fxt-modal-close:hover {
        color: #38bdf8;
      }
      .fxt-kit-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
      }
      @media (max-width: 600px) {
        .fxt-kit-grid { grid-template-columns: 1fr; }
      }
      .fxt-kit-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(56, 189, 248, 0.15);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: all 0.25s ease;
      }
      .fxt-kit-card:hover {
        background: rgba(56, 189, 248, 0.04);
        border-color: #38bdf8;
        transform: translateY(-2px);
      }
      .fxt-kit-name {
        font-family: 'Outfit', sans-serif;
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .fxt-kit-desc {
        font-size: 12px;
        color: #94a3b8;
        margin-bottom: 15px;
      }
      .fxt-download-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 8px;
        background: rgba(56, 189, 248, 0.1);
        border: 1px solid #38bdf8;
        color: #38bdf8;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.2s;
      }
      .fxt-download-btn:hover {
        background: linear-gradient(135deg, #38bdf8, #818cf8);
        color: #fff;
        box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
      }

      /* Tour Wizard Overlay Styles */
      .fxt-tour-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(4, 6, 12, 0.7);
        z-index: 99998;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
        display: none;
      }
      .fxt-tour-overlay.show {
        display: block;
        opacity: 1;
        pointer-events: auto;
      }
      .fxt-tour-card {
        position: fixed;
        z-index: 100000;
        background: #0f172a;
        border: 2px solid #38bdf8;
        box-shadow: 0 10px 30px rgba(56, 189, 248, 0.3);
        border-radius: 20px;
        width: 320px;
        padding: 24px;
        color: #f0f9ff;
        font-family: 'Plus Jakarta Sans', sans-serif;
        opacity: 0;
        transform: scale(0.9);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
        display: none;
      }
      .fxt-tour-card.show {
        display: block;
        opacity: 1;
        transform: scale(1);
        pointer-events: auto;
      }
      .fxt-tour-title {
        font-family: 'Outfit', sans-serif;
        font-weight: 800;
        font-size: 18px;
        color: #fff;
        margin-bottom: 8px;
      }
      .fxt-tour-body {
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.5;
        margin-bottom: 20px;
      }
      .fxt-tour-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .fxt-tour-skip {
        background: none;
        border: none;
        color: #64748b;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: color 0.2s;
      }
      .fxt-tour-skip:hover { color: #f43f5e; }
      .fxt-tour-next {
        background: linear-gradient(135deg, #38bdf8, #818cf8);
        border: none;
        color: #fff;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(56, 189, 248, 0.3);
      }
      .fxt-tour-next:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(56, 189, 248, 0.4);
      }
      /* Highlight pulse effect */
      .fxt-highlight-target {
        position: relative;
        z-index: 99999;
        box-shadow: 0 0 0 9999px rgba(4, 6, 12, 0.7), 0 0 15px #38bdf8 !important;
        border: 2px solid #38bdf8 !important;
        border-radius: 8px;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  // Inject Welcome Kit menu item into the sidebar
  function injectSidebarLink(role) {
    const navList = document.querySelector('.sidebar .nav-list') || document.querySelector('.nav-list');
    if (!navList) return;

    // Check if it already exists
    if (document.getElementById('fxtWelcomeKitLink')) return;

    const li = document.createElement('li');
    li.className = 'nav-item';
    li.id = 'fxtWelcomeKitLink';
    li.innerHTML = `
      <a href="#" style="display: flex; align-items: center; gap: 0.6rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a2.5 2.5 0 0 1 2.5-2.5H20v22H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>
        Welcome Kit
      </a>
    `;

    // Append right before the last element (typically logout or settings) or at the end
    const lastItem = navList.querySelector('li:last-child');
    if (lastItem) {
      navList.insertBefore(li, lastItem);
    } else {
      navList.appendChild(li);
    }

    // Attach click event
    li.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = document.getElementById('fxtWelcomeKitModal');
      if (modal) {
        modal.classList.add('show');
      }
    });
  }

  // Inject Welcome Kit Modal
  function injectDownloadModal(role, email, token) {
    if (document.getElementById('fxtWelcomeKitModal')) return;

    const isTeacher = role === 'teacher';
    const subPath = isTeacher ? 'teacher' : 'candidate';
    const trackingParams = `role=${subPath}&email=${encodeURIComponent(email)}&token=${token}`;

    const files = isTeacher ? [
      { name: 'welcome-letter.pdf', label: 'Welcome Letter', desc: 'Personal welcome letter from the Futrix Board.' },
      { name: 'user-manual.pdf', label: 'Teacher Operations Manual', desc: 'Complete guidebook for class management and test creation.' },
      { name: 'quick-start.pdf', label: 'Quick Start Checklist', desc: 'Get your Educator portal verified and ready in 5 minutes.' },
      { name: 'rules.pdf', label: 'Platform Guidelines', desc: 'Important teaching rules, grading policies, and guidelines.' },
      { name: 'contact.pdf', label: 'Educator Support Directory', desc: 'Direct contact handles for technical assistance.' },
      { name: 'social-links.pdf', label: 'Social & Communication links', desc: 'Join the educator discussion lounge.' },
      { name: 'teacher-presentation.pdf', label: 'Slide Deck: Platform Walkthrough', desc: 'Visual PPT slide introduction to main features.' }
    ] : [
      { name: 'welcome-letter.pdf', label: 'Welcome Letter', desc: 'Personal welcome and congratulations note.' },
      { name: 'user-manual.pdf', label: 'Candidate Operations Manual', desc: 'Detailed guidebook covering tests, Memory Lab, and XP.' },
      { name: 'quick-start.pdf', label: 'Quick Start Guide', desc: 'Getting started checklist for your first test series.' },
      { name: 'rules.pdf', label: 'Platform Integrity Policy', desc: 'Rules on academic integrity, security, and leagues.' },
      { name: 'privacy-policy.pdf', label: 'Privacy Policy', desc: 'How we securely encrypt and isolate your learning data.' },
      { name: 'terms.pdf', label: 'Terms of Service', desc: 'User agreement policies for student accounts.' },
      { name: 'contact.pdf', label: 'Helpdesk & Support Details', desc: 'Reach out for academic or technical questions.' },
      { name: 'social-links.pdf', label: 'Official Social Media Handles', desc: 'Instagram, Facebook, and WhatsApp Group links.' },
      { name: 'first-test.pdf', label: 'Test Arena Orientation Guide', desc: 'Tips to score maximum XP in your first mock test.' },
      { name: 'candidate-presentation.pdf', label: 'Slide Deck: Student Orientation', desc: 'Landscape PPT slide guide to the platform.' }
    ];

    const modalHTML = `
      <div class="fxt-modal" id="fxtWelcomeKitModal">
        <div class="fxt-modal-container">
          <div class="fxt-modal-header">
            <h3 class="fxt-modal-title">FUTRIX Welcome Kit & Download Center</h3>
            <button class="fxt-modal-close" id="fxtWelcomeKitClose">&times;</button>
          </div>
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 25px;">
            Welcome to FUTRIX! Please download your official onboarding documents below. 
            All files are generated dynamically and cryptographically secured for your account.
          </p>
          <div class="fxt-kit-grid">
            ${files.map(f => `
              <div class="fxt-kit-card">
                <div>
                  <div class="fxt-kit-name">${f.label}</div>
                  <div class="fxt-kit-desc">${f.desc}</div>
                </div>
                <a href="/api/onboarding/download?file=${f.name}&${trackingParams}" target="_blank" class="fxt-download-btn">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download PDF
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);

    // Close button event
    document.getElementById('fxtWelcomeKitClose').addEventListener('click', () => {
      document.getElementById('fxtWelcomeKitModal').classList.remove('show');
    });

    // Close modal on background click
    document.getElementById('fxtWelcomeKitModal').addEventListener('click', (e) => {
      if (e.target.id === 'fxtWelcomeKitModal') {
        document.getElementById('fxtWelcomeKitModal').classList.remove('remove');
        e.target.classList.remove('show');
      }
    });
  }

  // Check database if onboarding is completed, then trigger tour
  async function checkAndRunOnboardingTour(user, email, token) {
    let onboardingCompleted = false;

    // Check localStorage fallback first to prevent double triggers
    if (localStorage.getItem(`futrix_onboarding_done_${user.id}`)) {
      return;
    }

    try {
      if (window.supabase) {
        const { data: prof, error } = await window.supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle();
        if (!error && prof && prof.onboarding_completed) {
          onboardingCompleted = true;
        }
      }
    } catch (err) {
      console.warn("Could not check onboarding status from DB, using fallback:", err.message);
    }

    if (!onboardingCompleted) {
      // Launch Interactive Tour
      runTour(user, email, token);
    }
  }

  // Interactive Tour Step-by-Step wizard
  function runTour(user, email, token) {
    const isTeacher = user.role === 'teacher';
    
    // Inject overlay
    const overlay = document.createElement('div');
    overlay.className = 'fxt-tour-overlay show';
    overlay.id = 'fxtTourOverlay';
    document.body.appendChild(overlay);

    const steps = isTeacher ? [
      {
        title: "Welcome, Educator! 🎓",
        body: "Welcome to FUTRIX. Let's take a quick 3-step walkthrough to get you ready.",
        targetId: null
      },
      {
        title: "1. Classes & Cohorts Batch",
        body: "Manage student enrollments, batches, and monitor real-time class metrics.",
        targetId: "navClasses" // fallback or search sidebar
      },
      {
        title: "2. Secure Download Center",
        body: "Access educator onboarding presentations, guidelines, and welcome letters anytime from here.",
        targetId: "fxtWelcomeKitLink"
      }
    ] : [
      {
        title: "Welcome Competitor! 🏆",
        body: "Welcome to FUTRIX. Let's take a quick 4-step walkthrough to boost your prep efficiency.",
        targetId: null
      },
      {
        title: "1. Mock Exams Arena",
        body: "Attempt scheduled timed mock tests and full-length exam series here.",
        targetId: "sidebar"
      },
      {
        title: "2. The Memory Lab",
        body: "Scientifically revise previous incorrect questions using Spaced Repetition algorithms.",
        targetId: "sidebar"
      },
      {
        title: "3. Secure Onboarding Welcome Kit",
        body: "Access all manuals, guidelines, cheat sheets, and official helpdesk support directly from here.",
        targetId: "fxtWelcomeKitLink"
      }
    ];

    // Find custom targets inside sidebar lists or defaults
    if (!isTeacher) {
      const navLinks = document.querySelectorAll('.nav-list .nav-item a');
      navLinks.forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        if (text.includes('active') || text.includes('exam')) {
          steps[1].targetId = link.parentElement.id || 'fxt_target_exam';
          link.parentElement.id = 'fxt_target_exam';
          steps[1].targetId = 'fxt_target_exam';
        }
        if (text.includes('memory') || text.includes('lab') || text.includes('revision')) {
          steps[2].targetId = link.parentElement.id || 'fxt_target_memory';
          link.parentElement.id = 'fxt_target_memory';
          steps[2].targetId = 'fxt_target_memory';
        }
      });
    } else {
      const navLinks = document.querySelectorAll('.nav-list .nav-item a');
      navLinks.forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        if (text.includes('class') || text.includes('student') || text.includes('batch')) {
          steps[1].targetId = link.parentElement.id || 'fxt_target_classes';
          link.parentElement.id = 'fxt_target_classes';
          steps[1].targetId = 'fxt_target_classes';
        }
      });
    }

    // Create tour card element
    const tourCard = document.createElement('div');
    tourCard.className = 'fxt-tour-card show';
    tourCard.id = 'fxtTourCard';
    document.body.appendChild(tourCard);

    let currentStep = 0;

    function renderStep() {
      const step = steps[currentStep];
      
      // Clean previous highlights
      document.querySelectorAll('.fxt-highlight-target').forEach(el => {
        el.classList.remove('fxt-highlight-target');
      });

      tourCard.innerHTML = `
        <div class="fxt-tour-title">${step.title}</div>
        <div class="fxt-tour-body">${step.body}</div>
        <div class="fxt-tour-actions">
          <button class="fxt-tour-skip" id="fxtTourSkipBtn">Skip Tour</button>
          <button class="fxt-tour-next" id="fxtTourNextBtn">${currentStep === steps.length - 1 ? 'Finish 🏁' : 'Next ➜'}</button>
        </div>
      `;

      // Position tour card dynamically
      if (step.targetId) {
        const targetEl = document.getElementById(step.targetId);
        if (targetEl) {
          targetEl.classList.add('fxt-highlight-target');
          const rect = targetEl.getBoundingClientRect();
          tourCard.style.top = `${rect.top + window.scrollY}px`;
          tourCard.style.left = `${rect.right + 20}px`;
          // Prevent screen overflow
          if (rect.right + 340 > window.innerWidth) {
            tourCard.style.left = `${rect.left - 340}px`;
          }
        } else {
          centerTourCard();
        }
      } else {
        centerTourCard();
      }

      // Bind buttons
      document.getElementById('fxtTourSkipBtn').addEventListener('click', terminateTour);
      document.getElementById('fxtTourNextBtn').addEventListener('click', handleNext);
    }

    function centerTourCard() {
      tourCard.style.top = '50%';
      tourCard.style.left = '50%';
      tourCard.style.transform = 'translate(-50%, -50%) scale(1)';
    }

    function handleNext() {
      if (currentStep < steps.length - 1) {
        currentStep++;
        renderStep();
      } else {
        terminateTour();
      }
    }

    async function terminateTour() {
      // Clean highlights and remove elements
      document.querySelectorAll('.fxt-highlight-target').forEach(el => {
        el.classList.remove('fxt-highlight-target');
      });
      tourCard.classList.remove('show');
      overlay.classList.remove('show');
      setTimeout(() => {
        tourCard.remove();
        overlay.remove();
      }, 300);

      // Save completion status back to database
      localStorage.setItem(`futrix_onboarding_done_${user.id}`, 'true');
      try {
        await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token })
        });
        
        // Show success toast (using client toast if exists, or alert)
        if (window.showToast) {
          window.showToast('Onboarding tour completed! Welcome to Futrix! 🚀', 'success');
        } else {
          console.log('Onboarding tour completed!');
        }
      } catch (err) {
        console.error('Failed to save tour completion status:', err);
      }
    }

    renderStep();
  }

  // Render sleek Blocked Account Overlay
  function renderBlockedOverlay(email, blockReason) {
    const reasonText = blockReason || 'Account suspended by Futrix Security due to policy violation.';
    const overlay = document.createElement('div');
    overlay.id = 'futrixBlockedOverlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: #0a0e1a; z-index: 9999999; display: flex; flex-direction: column;
      justify-content: center; align-items: center; color: #fff;
      font-family: 'Sora', -apple-system, sans-serif; text-align: center; padding: 2rem;
    `;

    overlay.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 24px; padding: 3rem 2rem; max-width: 520px; width: 100%; box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.25); position: relative; overflow: hidden;">
        <div style="width: 72px; height: 72px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; font-size: 2.2rem; border: 2px solid #ef4444;">🚫</div>
        <h2 style="font-size: 1.8rem; font-weight: 800; color: #fff; margin-bottom: 0.5rem;">Account Suspended</h2>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.5;">Your FUTRIX account access has been temporarily suspended by platform administration.</p>
        
        <div style="background: #1e293b; border-left: 4px solid #ef4444; border-radius: 8px; padding: 1rem; text-align: left; margin-bottom: 2rem;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.3rem;">Reason for Suspension:</span>
          <p style="color: #f87171; font-size: 0.9rem; margin: 0; line-height: 1.4; font-weight: 600;">"${reasonText}"</p>
        </div>

        <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.5rem; line-height: 1.4;">If you believe this is an error or wish to appeal for unblocking, please contact Team Futrix.</p>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <a href="mailto:teamfutrix@gmail.com?subject=Account%20Unblock%20Request%20-%20${encodeURIComponent(email)}" style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; font-weight: 700; padding: 0.85rem 1.5rem; border-radius: 12px; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.4);">
            ✉️ Contact Support: teamfutrix@gmail.com
          </a>
          <a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" target="_blank" style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #22c55e; font-weight: 700; padding: 0.75rem 1.5rem; border-radius: 12px; text-decoration: none;">
            💬 Join WhatsApp Community Support
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }
})();
