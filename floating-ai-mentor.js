// Futrix Floating AI Mentor Widget
// Injects a premium, glassmorphic chat widget into all student pages.

(function () {
  // Wait for DOM to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }

  function initWidget() {
    // 1. Inject Styles
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      /* ── AI FLOATING BUTTON ── */
      .ai-chat-trigger {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4d8eff, #6fa3ff);
        box-shadow: 0 8px 32px rgba(77, 142, 255, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .ai-chat-trigger:hover {
        transform: scale(1.1) translateY(-2px);
        box-shadow: 0 12px 40px rgba(77, 142, 255, 0.6);
      }
      .ai-chat-trigger svg {
        color: white;
        width: 28px;
        height: 28px;
      }
      
      /* ── AI CHAT BOX ── */
      .ai-chat-container {
        position: fixed;
        bottom: 96px;
        right: 24px;
        width: 380px;
        height: 520px;
        z-index: 9998;
        background: rgba(22, 27, 39, 0.95);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: translateY(20px) scale(0.95);
        opacity: 0;
        pointer-events: none;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .ai-chat-container.show {
        transform: translateY(0) scale(1);
        opacity: 1;
        pointer-events: auto;
      }
      
      /* Header */
      .ai-chat-header {
        padding: 1.25rem;
        background: rgba(13, 16, 23, 0.7);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .ai-chat-header-info {
        display: flex;
        flex-direction: column;
      }
      .ai-chat-title {
        font-family: 'Sora', sans-serif;
        font-weight: 700;
        font-size: 1rem;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .ai-chat-tagline {
        font-size: 0.72rem;
        color: var(--text-muted, #6b7280);
      }
      .ai-chat-close-btn {
        background: none;
        border: none;
        color: var(--text-muted, #6b7280);
        cursor: pointer;
        padding: 0.25rem;
        transition: color 0.2s;
        display: flex;
        align-items: center;
      }
      .ai-chat-close-btn:hover {
        color: #fff;
      }

      /* Chat Messages */
      .ai-chat-messages {
        flex: 1;
        padding: 1.25rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        scrollbar-width: thin;
      }
      .ai-chat-bubble {
        max-width: 85%;
        padding: 0.8rem 1rem;
        border-radius: 14px;
        font-size: 0.88rem;
        line-height: 1.5;
      }
      .ai-chat-bubble.bot {
        background: rgba(255, 255, 255, 0.04);
        color: #e1e2ec;
        border: 1px solid rgba(255, 255, 255, 0.06);
        align-self: flex-start;
        border-top-left-radius: 2px;
      }
      .ai-chat-bubble.user {
        background: #4d8eff;
        color: #fff;
        align-self: flex-end;
        border-top-right-radius: 2px;
      }
      
      /* Input Area */
      .ai-chat-input-area {
        padding: 1rem;
        background: rgba(13, 16, 23, 0.5);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        gap: 0.6rem;
      }
      .ai-chat-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        color: #fff;
        padding: 0.75rem 1rem;
        font-size: 0.88rem;
        outline: none;
        transition: border-color 0.2s;
      }
      .ai-chat-input:focus {
        border-color: rgba(77, 142, 255, 0.5);
      }
      .ai-chat-send-btn {
        background: #4d8eff;
        border: none;
        border-radius: 10px;
        color: #fff;
        padding: 0 1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .ai-chat-send-btn:hover {
        background: #6fa3ff;
      }
      .ai-chat-send-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* Dot typing loader */
      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0.35rem 0.5rem;
      }
      .typing-dot {
        width: 6px;
        height: 6px;
        background: #adc6ff;
        border-radius: 50%;
        animation: typingBounce 1.4s infinite both;
      }
      .typing-dot:nth-child(2) { animation-delay: .2s; }
      .typing-dot:nth-child(3) { animation-delay: .4s; }
      
      @keyframes typingBounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }

      @media (max-width: 480px) {
        .ai-chat-container {
          width: calc(100% - 32px);
          height: 480px;
          bottom: 84px;
          right: 16px;
        }
        .ai-chat-trigger {
          bottom: 16px;
          right: 16px;
        }
      }
      @keyframes micPulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        70% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
      }
      .ai-mic-recording {
        background: #ef4444 !important;
        animation: micPulse 1.2s infinite !important;
      }
    `;
    document.head.appendChild(styleEl);

    // 2. Inject Trigger Button Markup
    const trigger = document.createElement('div');
    trigger.className = 'ai-chat-trigger';
    trigger.id = 'aiChatTrigger';
    trigger.innerHTML = `
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    `;
    document.body.appendChild(trigger);

    // 3. Inject Chat Container Markup
    const chatContainer = document.createElement('div');
    chatContainer.className = 'ai-chat-container';
    chatContainer.id = 'aiChatContainer';
    chatContainer.innerHTML = `
      <div class="ai-chat-header">
        <div class="ai-chat-header-info">
          <div class="ai-chat-title">
            <span style="color:#4d8eff">✦</span> FUTRIX AI Mentor
          </div>
          <div class="ai-chat-tagline">Learn. Decide. Grow.</div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <button class="ai-chat-close-btn" id="aiChatVoiceToggle" aria-label="Toggle Voice Response" style="margin-right:0.15rem; display:flex; align-items:center; justify-content:center;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" id="aiVoiceSvg">
              <!-- Speaker Muted (default) -->
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6L4.5 9H1.5v6h3l4.5 3.75V5.25z" />
            </svg>
          </button>
          <button class="ai-chat-close-btn" id="aiChatClose" style="display:flex; align-items:center; justify-content:center;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <!-- Settings Sub-bar -->
      <div class="ai-chat-settings-bar" style="display:flex; justify-content:space-between; align-items:center; padding:0.45rem 1rem; background:rgba(13, 16, 23, 0.4); border-bottom:1px solid rgba(255, 255, 255, 0.06); gap:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.3rem;">
          <label style="font-size:0.7rem; font-weight:600; color:#8a90a6;">Lang:</label>
          <select id="aiChatLangSelect" style="background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:#fff; font-size:0.7rem; padding:0.15rem 0.4rem; outline:none; cursor:pointer; font-family:'Sora',sans-serif;">
            <option value="English">English</option>
            <option value="Hinglish">Hinglish</option>
            <option value="Hindi">Hindi (हिंदी)</option>
            <option value="Tamil">Tamil (தமிழ்)</option>
            <option value="Telugu">Telugu (తెలుగు)</option>
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:0.35rem;">
          <input type="checkbox" id="aiChatAutoSpeak" style="width:13px; height:13px; cursor:pointer; accent-color:#4d8eff;" />
          <label for="aiChatAutoSpeak" style="font-size:0.7rem; font-weight:600; color:#8a90a6; cursor:pointer; user-select:none;">Auto-Speak Reply</label>
        </div>
      </div>
      <div class="ai-chat-messages" id="aiChatMessages">
        <div class="ai-chat-bubble bot" id="aiInitialGreeting">
          Hello! 🚀 I am your <strong>FUTRIX AI Mentor</strong>, your dedicated educational assistant. What exam stream (e.g. NEET, JEE, Board, etc.), subject, and topic do you need help with today?
        </div>
      </div>
      <div class="ai-chat-input-area">
        <input type="text" class="ai-chat-input" id="aiChatInput" placeholder="Enter your exam stream, subject, or query..." />
        <button class="ai-chat-send-btn" id="aiChatMic" aria-label="Record speech" style="background:rgba(255,255,255,0.06); padding:0 0.8rem; display:flex; align-items:center; justify-content:center;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" id="aiMicSvg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </button>
        <button class="ai-chat-send-btn" id="aiChatSend" aria-label="Send message" style="display:flex; align-items:center; justify-content:center;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(chatContainer);

    // ── TRIGGER EVENT LISTENERS ──
    const triggerBtn = document.getElementById('aiChatTrigger');
    const closeBtn = document.getElementById('aiChatClose');
    const box = document.getElementById('aiChatContainer');
    const sendBtn = document.getElementById('aiChatSend');
    const micBtn = document.getElementById('aiChatMic');
    const voiceToggleBtn = document.getElementById('aiChatVoiceToggle');
    const voiceSvg = document.getElementById('aiVoiceSvg');
    const inputEl = document.getElementById('aiChatInput');
    const messagesContainer = document.getElementById('aiChatMessages');

    let voiceEnabled = localStorage.getItem('ai_mentor_voice_enabled') === 'true';
    let currentAudio = null;
    let recognition = null;
    let isRecording = false;

    const autoSpeakCheckbox = document.getElementById('aiChatAutoSpeak');
    const langSelect = document.getElementById('aiChatLangSelect');

    // Initialize UI settings from localStorage or defaults
    if (autoSpeakCheckbox) {
      autoSpeakCheckbox.checked = voiceEnabled;
    }
    const savedLang = localStorage.getItem('ai_mentor_language') || 'English';
    if (langSelect) {
      langSelect.value = savedLang;
    }

    function updateVoiceIcons() {
      if (voiceEnabled) {
        // Speaker ON Icon SVG
        voiceSvg.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />`;
        voiceToggleBtn.style.color = '#4d8eff';
      } else {
        // Speaker OFF Icon SVG
        voiceSvg.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6L4.5 9H1.5v6h3l4.5 3.75V5.25z" />`;
        voiceToggleBtn.style.color = '';
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      }
      if (autoSpeakCheckbox) {
        autoSpeakCheckbox.checked = voiceEnabled;
      }
      localStorage.setItem('ai_mentor_voice_enabled', voiceEnabled ? 'true' : 'false');
    }
    updateVoiceIcons();

    // Toggle Voice Response setting via header button
    voiceToggleBtn.addEventListener('click', () => {
      voiceEnabled = !voiceEnabled;
      updateVoiceIcons();
    });

    // Toggle Voice Response setting via settings sub-bar checkbox
    if (autoSpeakCheckbox) {
      autoSpeakCheckbox.addEventListener('change', () => {
        voiceEnabled = autoSpeakCheckbox.checked;
        updateVoiceIcons();
      });
    }

    // Language-aware greeting texts (mirrors server-side langTemplates)
    const greetingTexts = {
      Hindi: 'नमस्ते! 🚀 मैं आपका <strong>FUTRIX AI Mentor</strong> हूँ — आपका समर्पित शिक्षा सहायक। आज आप किस exam stream (जैसे NEET, JEE, Board), subject, और topic में मदद चाहते हैं?',
      Hinglish: 'Hello! 🚀 Main aapka <strong>FUTRIX AI Mentor</strong> hoon — aapka dedicated educational assistant. Aaj aap kis exam stream (NEET, JEE, Board), subject, aur topic mein help chahte hain?',
      Tamil: 'வணக்கம்! 🚀 நான் உங்கள் <strong>FUTRIX AI Mentor</strong> — உங்கள் அர்ப்பணிப்பான கல்வி உதவியாளர். இன்று எந்த exam stream (NEET, JEE, Board), subject, மற்றும் topic-ல் உதவி வேண்டும்?',
      Telugu: 'నమస్కారం! 🚀 నేను మీ <strong>FUTRIX AI Mentor</strong> — మీ అంకితమైన విద్యా సహాయకుడు. ఈరోజు మీకు ఏ exam stream (NEET, JEE, Board), subject, మరియు topic లో సహాయం కావాలి?',
      English: 'Hello! 🚀 I am your <strong>FUTRIX AI Mentor</strong>, your dedicated educational assistant. What exam stream (e.g. NEET, JEE, Board, etc.), subject, and topic do you need help with today?'
    };

    function applyLanguage(lang) {
      // Update initial greeting bubble
      const greetingEl = document.getElementById('aiInitialGreeting');
      if (greetingEl) {
        greetingEl.innerHTML = greetingTexts[lang] || greetingTexts['English'];
      }
      // Update Speech Recognition locale
      if (recognition) {
        if (lang === 'Hindi' || lang === 'Hinglish') recognition.lang = 'hi-IN';
        else if (lang === 'Tamil') recognition.lang = 'ta-IN';
        else if (lang === 'Telugu') recognition.lang = 'te-IN';
        else recognition.lang = 'en-IN';
      }
      // Update input placeholder
      const inputEl2 = document.getElementById('aiChatInput');
      if (inputEl2) {
        if (lang === 'Hindi') inputEl2.placeholder = 'अपना exam stream, subject या topic लिखें...';
        else if (lang === 'Hinglish') inputEl2.placeholder = 'Apna exam stream, subject ya topic likhein...';
        else if (lang === 'Tamil') inputEl2.placeholder = 'உங்கள் exam stream, subject அல்லது topic எழுதுங்கள்...';
        else if (lang === 'Telugu') inputEl2.placeholder = 'మీ exam stream, subject లేదా topic రాయండి...';
        else inputEl2.placeholder = 'Enter your exam stream, subject, or query...';
      }
    }

    // Apply saved language on widget load
    applyLanguage(savedLang);

    // Handle language select change & sync to Supabase profile
    if (langSelect) {
      langSelect.addEventListener('change', async () => {
        const lang = langSelect.value;
        localStorage.setItem('ai_mentor_language', lang);
        applyLanguage(lang);

        try {
          if (typeof supabase !== 'undefined' && supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && session.user) {
              await supabase.from('profiles').update({ preferred_language: lang }).eq('id', session.user.id);
            }
          }
        } catch (err) {
          console.warn("Failed to sync language preference to profile:", err);
        }
      });
    }

    // Initialize Web Speech API for Speech-to-Text (STT)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN'; // Optimized for Indian English / Hindi mix!

      recognition.onstart = () => {
        isRecording = true;
        micBtn.classList.add('ai-mic-recording');
        inputEl.placeholder = "Listening...";
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        inputEl.value = transcript;
        inputEl.placeholder = "Enter your exam stream, subject, or query...";
        handleSendMessage();
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        stopRecording();
      };

      recognition.onend = () => {
        stopRecording();
      };
    }

    function stopRecording() {
      isRecording = false;
      micBtn.classList.remove('ai-mic-recording');
      inputEl.placeholder = "Enter your exam stream, subject, or query...";
      try { recognition.stop(); } catch(_) {}
    }

    function toggleRecording() {
      if (!recognition) {
        alert("Speech-to-text is not supported in this browser. Please try Google Chrome.");
        return;
      }
      if (isRecording) {
        stopRecording();
      } else {
        recognition.start();
      }
    }

    micBtn.addEventListener('click', toggleRecording);

    // ── TTS ENGINE: Consistent Indian Male Voice ──

    // ONE cached voice — selected once at startup, never changed
    let cachedVoice = null;
    let voiceInitialized = false;

    // Initialize the best available Indian male voice — called once, cached forever
    function initIndianMaleVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length || voiceInitialized) return;

      // Priority-ordered list of known good Indian male voices (Windows + Android + macOS)
      const preferredNames = [
        'prabhat',      // Microsoft Prabhat - Hindi (India) — best Indian male on Windows
        'hemant',       // Microsoft Hemant - Hindi (India)
        'karthik',      // Google Karthik - Tamil (India)
        'ravi',         // Microsoft Ravi - English (India)
        'madhur',       // Microsoft Madhur
        'mohan',        // Google Mohan - English (India)
        'rishi',        // Apple Rishi - English (India)
        'google hindi', // Google हिन्दी
        'google english (india)', // Google en-IN
      ];

      // Step 1: Try to find by known preferred name
      for (const pref of preferredNames) {
        const match = voices.find(v => v.name.toLowerCase().includes(pref));
        if (match) {
          cachedVoice = match;
          voiceInitialized = true;
          console.log(`[TTS] Locked to Indian male voice: "${match.name}" (${match.lang})`);
          return;
        }
      }

      // Step 2: Any Indian voice (-IN locale), skip obvious female names
      const femaleNames = ['heera', 'priya', 'lekha', 'female', 'woman', 'girl', 'zira', 'neerja', 'swara'];
      const indianVoices = voices.filter(v => v.lang.toLowerCase().replace('_','-').includes('-in'));
      if (indianVoices.length > 0) {
        const male = indianVoices.find(v => !femaleNames.some(f => v.name.toLowerCase().includes(f)));
        cachedVoice = male || indianVoices[0];
        if (male) {
          voiceInitialized = true;
        }
        console.log(`[TTS] Locked to Indian voice: "${cachedVoice.name}" (${cachedVoice.lang})`);
        return;
      }

      // Step 3: Any Google or Microsoft voice as last resort
      const quality = voices.find(v => v.name.includes('Google') || v.name.includes('Microsoft'));
      cachedVoice = quality || voices[0] || null;
      if (cachedVoice) {
        console.log(`[TTS] Fallback voice: "${cachedVoice.name}" (${cachedVoice.lang})`);
      }
    }

    // Eagerly initialize: voices may already be loaded, or wait for the event
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.getVoices().length > 0) {
        initIndianMaleVoice();
      }
      window.speechSynthesis.onvoiceschanged = initIndianMaleVoice;
    }

    // Phonetic transliteration helper for Indic scripts
    function transliterateIndicToRoman(text, lang) {
      if (!text) return '';

      const devnagariMap = {
        'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
        'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ः': 'h',
        'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
        'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
        'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
        'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
        'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
        'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
        'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gya', 'श्र': 'shr',
        '्': '', '़': '', '।': '.', 'ँ': 'n', 'ॐ': 'om'
      };

      const tamilMap = {
        'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'ee', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oo', 'ஔ': 'au', 'ஃ': 'akh',
        'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo', 'ெ': 'e', 'ே': 'ee', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oo', 'ௌ': 'au', '்': '',
        'க': 'k', 'ங': 'ng', 'ச': 'ch', 'ஞ': 'ny', 'ட': 't', 'ண': 'n', 'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
        'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh'
      };

      const teluguMap = {
        'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo', 'ఋ': 'ri', 'ఎ': 'e', 'ఏ': 'ee', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'oo', 'ఔ': 'au', 'అం': 'am', 'అః': 'aha',
        'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo', 'ృ': 'ri', 'ె': 'e', 'ే': 'ee', 'ై': 'ai', 'ొ': 'o', 'ో': 'oo', 'ౌ': 'au', 'ం': 'm', 'ః': 'ha', '్': '',
        'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
        'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n', 'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm', 'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v', 'శ': 'sha', 'ష': 'sha', 'స': 's', 'హ': 'h', 'ళ': 'la'
      };

      let map = devnagariMap;
      let consonants = 'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह';
      let matras = 'ािीुूृेैोौंः';
      
      if (lang === 'ta') {
        map = tamilMap;
        consonants = 'கஙசஞடணதநபமயரலவழளறனஜஷஸஹ';
        matras = 'ாிீுூெேைொோௌ';
      } else if (lang === 'te') {
        map = teluguMap;
        consonants = 'కఖగఘచఛజఝటఠడఢణతథదధనపఫబభమయరలవశషసహళ';
        matras = 'ాిీుూృెేైొోౌంః';
      }

      let result = '';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (map[char] !== undefined) {
          result += map[char];
          if (consonants.includes(char)) {
            const hasMatraOrHalant = nextChar && (matras.includes(nextChar) || nextChar === '्' || nextChar === '்' || nextChar === '్');
            const isEndOfWord = !nextChar || ' \t\n.,!?;:()""\'\''.includes(nextChar);
            if (!hasMatraOrHalant && !isEndOfWord) {
              result += 'a';
            }
          }
        } else {
          result += char;
        }
      }

      return result
        .replace(/aa+/g, 'aa')
        .replace(/ee+/g, 'ee')
        .replace(/oo+/g, 'oo')
        .replace(/a+/g, 'a')
        .trim();
    }

    // Clean & Preprocess text: Strips HTML, Emojis, Markdown, LaTeX, and Transliterates Indic script to Roman
    function preprocessTextForTTS(text) {
      if (!text) return '';
      let t = text;

      // 1. STRIP ALL VISUAL EMOJIS (Unicode Extended_Pictographic property + common ranges)
      t = t.replace(/\p{Extended_Pictographic}/gu, '');
      t = t.replace(/[\u{1F300}-\u{1FFFF}]/gu, '');
      t = t.replace(/[\u{2600}-\u{27BF}]/gu, '');
      t = t.replace(/[\u{1F000}-\u{1F02F}]/gu, '');
      t = t.replace(/\uFE0F/gu, '');
      t = t.replace(/\u200D/gu, '');
      t = t.replace(/[\u{2194}-\u{21AA}]/gu, '');
      t = t.replace(/[\u{23E9}-\u{23F3}]/gu, '');
      t = t.replace(/[\u{25AA}-\u{27BF}]/gu, '');

      // 2. STRIP HTML TAGS
      t = t.replace(/<[^>]*>/g, ' ');

      // 3. TRANSLITERATE INDIC REGIONAL SCRIPTS (Devanagari, Tamil, Telugu) to Roman script
      if (/[\u0900-\u097F]/.test(t)) {
        t = transliterateIndicToRoman(t, 'hi');
      }
      if (/[\u0B80-\u0BFF]/.test(t)) {
        t = transliterateIndicToRoman(t, 'ta');
      }
      if (/[\u0C00-\u0C7F]/.test(t)) {
        t = transliterateIndicToRoman(t, 'te');
      }

      // 4. STRIP MARKDOWN FORMATTING
      t = t.replace(/#{1,6}\s*/g, '');
      t = t.replace(/\*\*(.*?)\*\*/gs, '$1');
      t = t.replace(/__(.*?)__/gs, '$1');
      t = t.replace(/\*(.*?)\*/gs, '$1');
      t = t.replace(/_(.*?)_/g, '$1');
      t = t.replace(/`{3}[\s\S]*?`{3}/g, '');
      t = t.replace(/`[^`]+`/g, '');
      t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
      t = t.replace(/!\[.*?\]\(.*?\)/g, '');
      t = t.replace(/^\s*[-*+]\s+/gm, '');
      t = t.replace(/^\s*\d+\.\s+/gm, '');
      t = t.replace(/^>{1,}\s*/gm, '');
      t = t.replace(/^---+$/gm, '.');

      // 5. STRIP LATEX / MATH SYMBOLS
      t = t.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
      t = t.replace(/\$(.*?)\$/g, '$1');
      t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2');
      t = t.replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1');
      t = t.replace(/\\text\{([^}]+)\}/g, '$1');
      t = t.replace(/\\vec\{([^}]+)\}/g, '$1');
      t = t.replace(/\\rightarrow/g, 'goes to');
      t = t.replace(/\\times/g, 'times');
      t = t.replace(/\\div/g, 'divided by');
      t = t.replace(/\\pm/g, 'plus or minus');
      t = t.replace(/\\[a-zA-Z]+\{[^}]*\}/g, '');
      t = t.replace(/\\[a-zA-Z]+/g, '');

      // 6. EXPAND ACROYNMS & BRAND NAMES
      const abbrevMap = [
        ['FUTRIX AI', 'Fewtricks AI'],
        ['FUTRIX', 'Fewtricks'],
        ['NEET', 'Neet'],
        ['JEE Advanced', 'Jee Advanced'],
        ['JEE Mains', 'Jee Mains'],
        ['JEE', 'Jee'],
        ['AIIMS', 'A I I M S'],
        ['UPSC', 'U P S C'],
        ['NCERT', 'N C E R T'],
        ['CBSE', 'C B S E'],
        ['ICSE', 'I C S E'],
        ['CUET', 'Q yet'],
        ['CLAT', 'Claat'],
        ['GATE', 'Gate'],
        ['IIT', 'I I T'],
        ['NIT', 'N I T'],
        ['NDA', 'N D A'],
        ['SSC', 'S S C'],
        ['IBPS', 'I B P S'],
        ['PCM', 'Physics Chemistry Maths'],
        ['PCB', 'Physics Chemistry Biology'],
        ['DNA', 'D N A'],
        ['RNA', 'R N A'],
        ['ATP', 'A T P'],
        ['MCQs', 'multiple choice questions'],
        ['MCQ', 'multiple choice question'],
        ['XP', 'experience points'],
        ['OTP', 'one time password'],
        ['i.e.', 'that is,'],
        ['e.g.', 'for example,'],
        ['etc.', 'and so on'],
        ['vs.', 'versus'],
        ['vs', 'versus'],
      ];
      for (const [abbr, expansion] of abbrevMap) {
        const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        t = t.replace(new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, 'g'), expansion);
      }

      // 7. EXPAND ORDINALS
      const ordinals = {
        '1st':'first', '2nd':'second', '3rd':'third', '4th':'fourth', '5th':'fifth',
        '6th':'sixth', '7th':'seventh', '8th':'eighth', '9th':'ninth', '10th':'tenth',
        '11th':'eleventh', '12th':'twelfth', '20th':'twentieth', '100th':'hundredth'
      };
      for (const [ord, word] of Object.entries(ordinals)) {
        t = t.replace(new RegExp(`\\b${ord}\\b`, 'gi'), word);
      }

      // 8. CONVERT METRIC / MATH SYMBOLS
      t = t.replace(/°C/g, ' degrees Celsius ');
      t = t.replace(/°F/g, ' degrees Fahrenheit ');
      t = t.replace(/°/g, ' degrees ');
      t = t.replace(/%/g, ' percent ');
      t = t.replace(/₹/g, ' rupees ');
      t = t.replace(/\$/g, ' ');
      t = t.replace(/&/g, ' and ');
      t = t.replace(/\//g, ' ');

      // 9. CLEANUP STRUCTURAL NOISE
      t = t.replace(/\n{2,}/g, '. ');
      t = t.replace(/\n/g, ', ');
      t = t.replace(/[|~^\\]/g, ' ');
      t = t.replace(/[-]{2,}/g, ' ');
      t = t.replace(/[()[\]{}]/g, ' ');
      t = t.replace(/\s{2,}/g, ' ');
      t = t.replace(/\.{2,}/g, '.');
      t = t.replace(/,\s*,/g, ',');
      t = t.trim();

      return t;
    }

    // Split text into natural sentences
    function splitIntoSentences(text) {
      if (!text) return [];
      const raw = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
      return raw.map(s => s.trim()).filter(s => s.length > 2);
    }

    // Speak sentences one-by-one with human breathing gaps
    function speakWithRhythm(sentences) {
      if (!sentences.length) return;
      let idx = 0;

      const voice = cachedVoice;

      function speakNext() {
        if (idx >= sentences.length || !voiceEnabled) return;

        const utt = new SpeechSynthesisUtterance(sentences[idx]);

        // Always set lang to en-IN so Chrome does not override the voice object assignment
        utt.lang = 'en-IN';
        if (voice) utt.voice = voice;

        // Optimized rate & pitch for clear, deliberate Indian male accent
        utt.rate = 0.82;
        utt.pitch = 0.92;
        utt.volume = 1.0;

        utt.onend = () => {
          idx++;
          if (idx < sentences.length) {
            const prev = sentences[idx - 1];
            const pause = prev.endsWith('?') ? 320 : prev.endsWith('!') ? 220 : 160;
            setTimeout(speakNext, pause);
          }
        };

        utt.onerror = (e) => {
          if (e.error !== 'interrupted') {
            console.warn('[TTS] utterance error:', e.error);
          }
          idx++;
          if (idx < sentences.length) setTimeout(speakNext, 80);
        };

        window.speechSynthesis.speak(utt);
      }

      speakNext();
    }

    // ── Main TTS Entry Point ──
    async function playVoiceResponse(text) {
      if (!voiceEnabled) return;

      // Stop any playing audio
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      // Ensure voice is initialized
      if (!voiceInitialized && 'speechSynthesis' in window) {
        await new Promise(resolve => {
          const v = window.speechSynthesis.getVoices();
          if (v.length > 0) { initIndianMaleVoice(); return resolve(); }
          const prev = window.speechSynthesis.onvoiceschanged;
          window.speechSynthesis.onvoiceschanged = () => { initIndianMaleVoice(); resolve(); if (prev) prev(); };
          setTimeout(() => { initIndianMaleVoice(); resolve(); }, 2000);
        });
      }

      // Preprocess and clean text (strip emoji, markdown, LaTeX, and transliterate regional scripts)
      const cleanText = preprocessTextForTTS(text);
      if (!cleanText) return;

      // Try ElevenLabs premium TTS first
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (typeof supabase !== 'undefined' && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch('/api/ai/tts', {
          method: 'POST', headers,
          body: JSON.stringify({ text: cleanText })
        });
        if (res.ok) {
          const blob = await res.blob();
          currentAudio = new Audio(URL.createObjectURL(blob));
          currentAudio.play();
          return; // Premium TTS succeeded
        }
      } catch (_) { /* fall through to browser TTS */ }

      // Browser SpeechSynthesis fallback
      if (!('speechSynthesis' in window)) return;
      const sentences = splitIntoSentences(cleanText);
      speakWithRhythm(sentences);
    }


    triggerBtn.addEventListener('click', () => {
      box.classList.toggle('show');
    });

    closeBtn.addEventListener('click', () => {
      box.classList.remove('show');
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
    });

    let activeFeatureContext = 'mentor_chat';
    let activeSubjectContext = '';
    let activeChapterContext = '';

    window.triggerMentorAi = function (queryText, featureVal = 'mentor_chat', subjectVal = '', chapterVal = '') {
      const box = document.getElementById('aiChatContainer');
      const inputEl = document.getElementById('aiChatInput');
      if (box) box.classList.add('show');
      
      activeFeatureContext = featureVal;
      activeSubjectContext = subjectVal;
      activeChapterContext = chapterVal;

      if (inputEl && queryText) {
        inputEl.value = queryText;
        handleSendMessage();
      }
    };

    // Handle Send
    async function handleSendMessage() {
      const query = inputEl.value.trim();
      if (!query) return;

      // Add user message
      addMessage(query, 'user');
      inputEl.value = '';

      // Add typing indicator
      const loader = addTypingIndicator();
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        let responseText = '';
        
        // Send language as a clean separate parameter, not appended to query text
        const selectedLang = localStorage.getItem('ai_mentor_language') || 'English';

        // 1. Query the Central AI Service endpoint
        if (typeof supabase !== 'undefined' && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          const headers = { 'Content-Type': 'application/json' };
          if (session && session.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }

          const screenName = (function () {
            const path = window.location.pathname;
            if (path.includes('memory-lab.html')) return 'memory-lab';
            if (path.includes('roadmap.html')) return 'roadmap';
            if (path.includes('instruction.html')) return 'instruction';
            if (path.includes('active-exams.html')) return 'active-exams';
            if (path.includes('performance.html')) return 'performance';
            if (path.includes('leaderboard.html')) return 'leaderboard';
            if (path.includes('arena.html')) return 'arena';
            return 'dashboard';
          })();

          const res = await fetch('/api/ai/complete', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              query,
              language: selectedLang,
              screen: screenName,
              feature: activeFeatureContext,
              subject: activeSubjectContext,
              chapter: activeChapterContext,
              sessionId: 'session_student_mentor'
            })
          });

          // Reset context after sending
          activeFeatureContext = 'mentor_chat';
          activeSubjectContext = '';
          activeChapterContext = '';

          if (res.ok) {
            const resData = await res.json();
            responseText = resData.response;
          } else {
            console.warn('Central AI Service returned an error, using local fallback...');
          }
        }

        // 2. Client-side restriction fallback if server fails
        if (!responseText) {
          responseText = getLocalRestrictionResponse(query);
          // Log fallback usage to Supabase directly so analytics still work
          await logAiUsage(query, responseText, Math.ceil((query.length + responseText.length) / 4));
        }

        // Remove loading and add bot response
        loader.remove();
        addMessage(responseText, 'bot');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Play TTS audio synthesized response
        playVoiceResponse(responseText);

      } catch (err) {
        console.error('Chat AI query error:', err);
        loader.remove();
        const failText = "I am having trouble connecting right now. Please try again later.";
        addMessage(failText, 'bot');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    sendBtn.addEventListener('click', handleSendMessage);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSendMessage();
    });

    function addMessage(text, sender) {
      const bubble = document.createElement('div');
      bubble.className = `ai-chat-bubble ${sender}`;
      bubble.innerHTML = formatMarkdown(text);
      messagesContainer.appendChild(bubble);
    }

    function addTypingIndicator() {
      const bubble = document.createElement('div');
      bubble.className = 'ai-chat-bubble bot';
      bubble.innerHTML = `
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
      messagesContainer.appendChild(bubble);
      return bubble;
    }

    // ── LOCAL KNOWLEDGE RESTRICTION ENGINE (FALLBACK) ──
    function getLocalRestrictionResponse(query) {
      const q = query.toLowerCase().trim();

      const allowedKeywords = [
        'neet', 'jee', 'physics', 'chemistry', 'biology', 'mathematics', 'math', 'study', 
        'revision', 'exam', 'schedule', 'planning', 'futrix', 'xp', 'rank', 'test', 'question', 'score'
      ];
      
      const blockedKeywords = [
        'politic', 'religion', 'entertainment', 'movie', 'actor', 'song', 'music', 'game', 
        'coding', 'program', 'python', 'javascript', 'html', 'css', 'coding help', 'code error',
        'legal', 'court', 'lawyer', 'medical advice', 'doctor prescription', 'disease treatment',
        'hello', 'how are you', 'what is your name', 'tell me a joke', 'weather'
      ];

      let isAllowed = false;
      for (const kw of allowedKeywords) {
        if (q.includes(kw)) {
          isAllowed = true;
          break;
        }
      }

      for (const bw of blockedKeywords) {
        if (q.includes(bw)) {
          isAllowed = false;
          break;
        }
      }

      if (!isAllowed) {
        return "I am an educational AI mentor. I can only assist with educational and study-related topics.";
      }

      if (q.includes('revision') || q.includes('study') || q.includes('planning') || q.includes('neet') || q.includes('jee') || q.includes('exam')) {
        return "Preparing for exams requires a structured schedule. Focus on: \n\n1. **Concept Clarity**: Clear all fundamentals from standard materials.\n2. **Practice & Mock Tests**: Regularly solve past papers on the **FUTRIX** exam center.\n3. **Analytics**: Review weak areas inside your FUTRIX Performance page.";
      }

      return "I am an educational AI mentor. I can only assist with educational and study-related topics.";
    }

    // Simple markdown formattter
    function formatMarkdown(text) {
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/•\s(.*?)/g, '<li>$1</li>');
    }
  }
})();
