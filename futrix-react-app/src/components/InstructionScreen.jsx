import React, { useState, useEffect } from 'react';
import Header from './common/Header';
import { APPS_SCRIPT_URL, jsonpRequest } from '../utils/api';

const InstructionScreen = ({ user, onNavigate, onShowToast, onLogout }) => {
  const [isChecked, setIsChecked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  const [showMoreInstructions, setShowMoreInstructions] = useState(false);

  // Sidebar toggle state (mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Exam config state
  const [examConfig, setExamConfig] = useState({
    success: true,
    seriesId: '#FX-0001',
    questions: 20,
    duration: 30,
    maxMarks: 20
  });

  // Calculate rank grade based on XP
  const getGrade = (xpPoints) => {
    if (xpPoints >= 500) return 'S+';
    if (xpPoints >= 300) return 'S';
    if (xpPoints >= 200) return 'A+';
    if (xpPoints >= 150) return 'A';
    if (xpPoints >= 120) return 'B+';
    if (xpPoints >= 100) return 'B';
    return 'C';
  };

  const grade = getGrade(user.xp || 100);

  // Split name for visual layout
  const nameParts = (user.name || 'Pilot').split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  // Fetch config and check attempt status on mount
  useEffect(() => {
    const fetchConfigAndStatus = async () => {
      let currentSeriesId = examConfig.seriesId;
      let data = null;

      // 1. Fetch configuration
      try {
        data = await jsonpRequest(APPS_SCRIPT_URL, { action: 'getConfig' });
      } catch (err) {
        console.warn('JSONP fetch config failed, trying fetch fallback...', err);
        try {
          const res = await fetch(`${APPS_SCRIPT_URL}?action=getConfig`, { redirect: 'follow' });
          const text = await res.text();
          const cleaned = text.trim()
            .replace(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, '')
            .replace(/\)\s*;?\s*$/, '');
          data = JSON.parse(cleaned);
        } catch (fetchErr) {
          console.error('Fetch fallback config failed:', fetchErr);
        }
      }

      if (data && data.success) {
        setExamConfig(data);
        sessionStorage.setItem('futrix_exam_config', JSON.stringify(data));
        currentSeriesId = data.seriesId;
      }

      // 2. Check if user has already attempted this series (Server check first, then Local Storage fallback)
      const userEmail = (user.email || '').toLowerCase().trim();
      const localKeyUser = `attempted_${userEmail}_${currentSeriesId}`;
      
      // Quick check via Apps Script (database check)
      try {
        let checkRes = null;
        try {
          checkRes = await jsonpRequest(APPS_SCRIPT_URL, {
            action: 'checkAttempt',
            email: userEmail,
            candidateEmail: userEmail,
            emailAddress: userEmail,
            seriesId: currentSeriesId,
            series: currentSeriesId
          });
        } catch (err) {
          console.warn('JSONP attempt verify failed, trying fetch fallback...', err);
          try {
            const url = `${APPS_SCRIPT_URL}?action=checkAttempt&email=${encodeURIComponent(userEmail)}&seriesId=${encodeURIComponent(currentSeriesId)}`;
            const res = await fetch(url);
            const txt = await res.text();
            const cleaned = txt.trim().replace(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, '').replace(/\)\s*;?\s*$/, '');
            checkRes = JSON.parse(cleaned);
          } catch (fetchErr) {
            console.error('Fetch attempt verify failed:', fetchErr);
          }
        }

        if (checkRes) {
          if (checkRes.attempted) {
            setAlreadyAttempted(true);
            localStorage.setItem(localKeyUser, 'true');
          } else {
            setAlreadyAttempted(false);
            localStorage.removeItem(localKeyUser);
          }
        } else {
          // Fallback to local storage on network error
          const hasLocalAttempt = localStorage.getItem(localKeyUser) === 'true';
          setAlreadyAttempted(hasLocalAttempt);
        }
      } catch (e) {
        console.error('Error verifying attempt status:', e);
        // Fallback to local storage on error
        const hasLocalAttempt = localStorage.getItem(localKeyUser) === 'true';
        setAlreadyAttempted(hasLocalAttempt);
      }
    };

    fetchConfigAndStatus();
  }, [user.email]);

  const handleStartTest = async () => {
    if (!isChecked) return;
    setIsChecking(true);

    const seriesId = examConfig.seriesId;
    const userEmail = (user.email || '').toLowerCase().trim();
    const localKeyUser = `attempted_${userEmail}_${seriesId}`;

    let done = false;
    let checkedSuccessfully = false;

    try {
      const check = await jsonpRequest(APPS_SCRIPT_URL, {
        action: 'checkAttempt',
        email: userEmail,
        candidateEmail: userEmail,
        emailAddress: userEmail,
        seriesId: seriesId,
        series: seriesId
      });
      if (check) {
        done = check.attempted;
        checkedSuccessfully = true;
      }
    } catch (err) {
      console.warn('Failed to verify attempt status online, trying plain fetch...', err);
      try {
        const url = `${APPS_SCRIPT_URL}?action=checkAttempt&email=${encodeURIComponent(userEmail)}&seriesId=${encodeURIComponent(seriesId)}`;
        const res = await fetch(url);
        const txt = await res.text();
        const cleaned = txt.trim().replace(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, '').replace(/\)\s*;?\s*$/, '');
        const check = JSON.parse(cleaned);
        if (check) {
          done = check.attempted;
          checkedSuccessfully = true;
        }
      } catch (fetchErr) {
        console.error('Plain fetch attempt verification failed:', fetchErr);
      }
    }

    if (!checkedSuccessfully) {
      // Fallback to local storage on network error
      done = localStorage.getItem(localKeyUser) === 'true';
    }

    setIsChecking(false);

    if (done) {
      setAlreadyAttempted(true);
      localStorage.setItem(localKeyUser, 'true');
    } else {
      localStorage.removeItem(localKeyUser);
      onNavigate('exam');
    }
  };

  return (
    <div className="instruction-page-container">
      <Header mode="instruction" onLogout={onLogout} />

      {/* Sidebar Toggle (mobile) */}
      <button 
        className="sidebar-toggle" 
        onClick={() => setSidebarOpen(prev => !prev)}
        aria-label="Toggle sidebar"
        id="sidebarToggle"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {sidebarOpen && (
        <div className="sidebar-overlay open" onClick={() => setSidebarOpen(false)}></div>
      )}

      <div className="layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
          {/* Profile */}
          <div className="sidebar-profile">
            <div className="profile-avatar">{user.name ? user.name.charAt(0).toUpperCase() : 'FP'}</div>
            <div className="profile-info">
              <div className="profile-name">{user.name || 'Futrix Pilot'}</div>
              <div className="profile-level">XP: <span>{(user.xp || 100).toFixed(2)}</span></div>
            </div>
          </div>

          {/* Navigation */}
          <ul className="nav-list">
            <li className="nav-item">
              <a href="#" className="active" onClick={e => e.preventDefault()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Dashboard
              </a>
            </li>
            {['Active Exams', 'Performance', 'Leaderboard', 'Settings'].map((item, idx) => {
              const icons = [
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>
              ];
              return (
                <li className="nav-item" key={item}>
                  <a href="#" onClick={e => e.preventDefault()}>
                    {icons[idx]}
                    {item}
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Bottom links */}
          <div className="sidebar-bottom">
            <button className="btn-upgrade">Upgrade to Pro</button>
            <ul className="bottom-links">
              <li>
                <a href="#" onClick={e => e.preventDefault()}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  Help
                </a>
              </li>
              <li>
                <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Logout
                </a>
              </li>
            </ul>
          </div>
        </aside>

        {/* Main Content Pane */}
        <div className="main-content">
          {!alreadyAttempted ? (
            <div className="panels-layout">
              {/* Candidate details panel */}
              <div className="candidate-panel">
                {/* Candidate XP score card */}
                <div className="candidate-card">
                  <div className="candidate-tag">Candidate</div>
                  <div className="candidate-name" id="candidateName">
                    {firstName}
                    {lastName && <><br />{lastName}</>}
                  </div>
                  <button className="settings-btn" aria-label="Settings" onClick={e => e.preventDefault()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>
                  </button>
                  <div className="reward-row">
                    <div className="reward-block">
                      <span className="reward-label">Total XP Points</span>
                      <div className="reward-value">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '0.2rem' }}><circle cx="12" cy="12" r="10" /></svg>
                        <span>{(user.xp || 100).toFixed(2)}</span> <span className="reward-unit">XP</span>
                      </div>
                    </div>
                    <div className="reward-block">
                      <span className="reward-label">Rank</span>
                      <div className="rank-value">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        <span>{grade}</span>
                      </div>
                    </div>
                  </div>
                  {/* Referral XP Row */}
                  <div className="reward-row" style={{ marginTop: '0.8rem', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '0.8rem' }}>
                    <div className="reward-block">
                      <span className="reward-label">Referral XP</span>
                      <div className="reward-value" style={{ color: 'var(--teal)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '0.2rem', color: 'var(--teal)' }}><circle cx="12" cy="12" r="10" /></svg>
                        <span>{(user.referralXp || 0).toFixed(2)}</span> <span className="reward-unit" style={{ color: 'var(--teal)' }}>XP</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exam Configuration details card */}
                <div className="exam-details-card">
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Series</span>
                      <span className="detail-value">{examConfig.seriesId}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Questions</span>
                      <span className="detail-value">{examConfig.questions} items</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Max Marks</span>
                      <span className="detail-value">{examConfig.maxMarks || examConfig.questions} pts</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Duration</span>
                      <span className="detail-value">{examConfig.duration} mins</span>
                    </div>
                  </div>
                  <div className="negative-marking">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Negative Marking: -0.25/wrong
                  </div>
                </div>
              </div>

              {/* Instructions text list panel */}
              <div className="instruction-panel">
                <h2 className="inst-title">System Instructions</h2>
                <p className="inst-intro">
                  Welcome to the <strong>Futrix Pilot Evaluation System 🚀</strong>
                  This test evaluates your analytical thinking, consistency, discipline, and competitive performance under real exam conditions.
                </p>

                {/* Scrollable list */}
                <div className="inst-scroll">
                  <div className="inst-section">
                    <div className="inst-section-title">🎯 XP Reward System</div>
                    <ul>
                      <li className="success">Every <strong>correct answer</strong> awards <strong>+1 XP Point</strong></li>
                      <li className="danger">Every <strong>incorrect answer</strong> deducts <strong>−0.25 XP Point</strong></li>
                      <li>Unattempted questions will <strong>not affect</strong> your XP</li>
                      <li>XP points help increase your <strong>Futrix Rank</strong> and unlock future rewards</li>
                    </ul>
                  </div>

                  {/* Toggle Read More Button (shown only when collapsed) */}
                  {!showMoreInstructions && (
                    <div style={{ textAlign: 'center', margin: '0.5rem 0 1.2rem' }}>
                      <button 
                        type="button" 
                        onClick={() => setShowMoreInstructions(true)}
                        style={{
                          background: 'rgba(77, 142, 255, 0.08)',
                          border: '1px dashed var(--primary-btn)',
                          color: 'var(--primary)',
                          padding: '0.5rem 1.1rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontFamily: "'Sora', sans-serif",
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          transition: 'all 0.2s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(77, 142, 255, 0.15)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(77, 142, 255, 0.08)'; }}
                      >
                        <span>📖</span> Read More Instructions
                      </button>
                    </div>
                  )}

                  {showMoreInstructions && (
                    <>
                      <div className="inst-section">
                        <div className="inst-section-title">💎 Future XP Benefits</div>
                        <ul>
                          <li>Cash reward conversions</li>
                          <li>Discount coupons &amp; Exclusive offers</li>
                          <li>Premium feature unlocks</li>
                          <li>Scholarship opportunities &amp; Sponsored learning programs</li>
                          <li>Community leaderboard rewards</li>
                        </ul>
                        <div className="inst-note">The more <strong>consistently you perform</strong>, the greater your future benefits.</div>
                      </div>

                      <div className="inst-section">
                        <div className="inst-section-title">🏆 Sponsorship &amp; Rank Opportunities</div>
                        <ul>
                          <li>Sponsorship opportunities &amp; Premium mentorship access</li>
                          <li>Featured leaderboard positions</li>
                          <li>Early access to Futrix programs</li>
                          <li>Community recognition badges</li>
                        </ul>
                      </div>

                      <div className="inst-section">
                        <div className="inst-section-title">🔥 Daily XP Opportunities</div>
                        <ul>
                          <li>Daily mock tests &amp; Quiz battles</li>
                          <li>Streak rewards &amp; Special challenges</li>
                          <li>Referral missions &amp; Leaderboard events</li>
                        </ul>
                        <div className="inst-note"><strong>Consistency</strong> matters more than one-time performance.</div>
                      </div>

                      <div className="inst-section">
                        <div className="inst-section-title">👥 Referral Reward Program</div>
                        <ul>
                          <li className="success">Every successful referral gives <strong>+100 XP Points</strong></li>
                          <li>Referral bonuses may increase during special campaigns</li>
                          <li className="danger">Abuse or fake referrals will result in <strong>XP removal</strong></li>
                        </ul>
                      </div>

                      <div className="inst-section">
                        <div className="inst-section-title">⚠️ Anti-Cheating &amp; Fair Play Policy</div>
                        <ul>
                          <li className="danger">Tab switching repeatedly</li>
                          <li className="danger">Using external help / tools</li>
                          <li className="danger">Multiple device access</li>
                          <li className="danger">Copy-pasting answers or suspicious behavior</li>
                        </ul>
                        <div className="inst-note" style={{ borderColor: 'rgba(255,154,60,0.3)', background: 'rgba(255,154,60,0.06)' }}>
                          If detected: XP → 0 · Result invalidated · Account warning · Possible suspension
                        </div>
                      </div>

                      {/* Toggle Hide Button (shown only when expanded at the bottom) */}
                      <div style={{ textAlign: 'center', margin: '0.5rem 0 1.2rem' }}>
                        <button 
                          type="button" 
                          onClick={() => setShowMoreInstructions(false)}
                          style={{
                            background: 'rgba(77, 142, 255, 0.08)',
                            border: '1px dashed var(--primary-btn)',
                            color: 'var(--primary)',
                            padding: '0.5rem 1.1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontFamily: "'Sora', sans-serif",
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(77, 142, 255, 0.15)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(77, 142, 255, 0.08)'; }}
                        >
                          <span>📖</span> Hide Instructions
                        </button>
                      </div>
                    </>
                  )}

                  <div className="inst-section">
                    <div className="inst-section-title">📌 Important Guidelines</div>
                    <ul>
                      <li>Ensure stable internet connectivity</li>
                      <li>Do not refresh the page during exam</li>
                      <li>Read every question carefully &amp; manage time wisely</li>
                      <li>Submit before the timer ends — once submitted, answers <strong>cannot be changed</strong></li>
                    </ul>
                  </div>

                  <div className="inst-note" style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                    <strong>Compete fairly · Earn XP · Climb ranks · Unlock opportunities</strong><br />
                    <span style={{ color: 'var(--primary)' }}>Good luck, Pilot ⚡</span>
                  </div>
                </div>

                {/* Confirm checkbox and start trigger */}
                <div className="inst-footer">
                  <label className="confirm-label" id="confirmLabel">
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={(e) => setIsChecked(e.target.checked)}
                      disabled={isChecking}
                    />
                    <span>I have read and agree to all Futrix rules, XP policies, and fair-play guidelines.</span>
                  </label>
                  <button 
                    className={`btn-start ${isChecked && !isChecking ? 'ready' : ''}`} 
                    disabled={!isChecked || isChecking}
                    onClick={handleStartTest}
                  >
                    {isChecking ? 'Checking...' : 'Start Test'}
                    <span>🚀</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Lock screen
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100%',
              gap: '1.5rem',
              textAlign: 'center',
              padding: '2.5rem 2rem',
              background: 'rgba(26, 31, 46, 0.4)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '3.5rem', animation: 'pulse 2s infinite' }}>✅</div>
              <h2 style={{
                fontFamily: "'Sora',sans-serif",
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '-0.5rem',
                background: 'linear-gradient(135deg, #e1e2ec 0%, var(--primary) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>Already Completed!</h2>
              
              <p style={{ fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.7, maxWidth: '480px', fontWeight: 500 }}>
                You have already completed the <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>{examConfig.seriesId}</strong> Test Series.
              </p>
              
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '440px', marginTop: '-0.5rem' }}>
                Please wait for the next upcoming test series. Thank you, Pilot! 🚀
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem', width: '100%', maxWidth: '480px', textAlign: 'left', marginTop: '0.5rem' }}>
                <div style={{ background: 'rgba(0, 230, 118, 0.06)', border: '1px solid rgba(0, 230, 118, 0.25)', borderRadius: '12px', padding: '0.95rem 1.2rem', fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5, display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🏆</span>
                  <div>Your XP Points are safely secured — get ready to earn even more XP in the next series and climb the Futrix leaderboard.</div>
                </div>
                
                <div style={{ background: 'rgba(77, 142, 255, 0.06)', border: '1px solid rgba(77, 142, 255, 0.25)', borderRadius: '12px', padding: '0.95rem 1.2rem', fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5, display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>👥</span>
                  <div>Refer your friends and earn <strong style={{ color: 'var(--primary)' }}>+100 XP Points</strong> for every successful referral.</div>
                </div>

                <div style={{ background: 'rgba(0, 229, 212, 0.06)', border: '1px solid rgba(0, 229, 212, 0.25)', borderRadius: '12px', padding: '0.95rem 1.2rem', fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5, display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>📢</span>
                  <div>Join and invite others to the <a href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 700 }}>Futrix WhatsApp Community</a> to earn an additional <strong style={{ color: 'var(--teal)' }}>+100 XP Points</strong> and stay updated with upcoming test series, rewards, and sponsorship opportunities.</div>
                </div>
              </div>

              <button 
                onClick={() => setAlreadyAttempted(false)} 
                style={{
                  marginTop: '0.8rem', padding: '0.8rem 2.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)',
                  background: '#222838', color: '#e1e2ec', fontFamily: "'Sora',sans-serif", fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)', transition: 'background 0.2s, transform 0.2s'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#2b3247';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#222838';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                ← Return to Dashboard
              </button>
            </div>
          )}

          {/* WhatsApp Community footer */}
          <footer style={{
            padding: '1.2rem 2rem',
            border: '1px solid var(--border)',
            background: 'var(--sidebar-bg)',
            borderRadius: '16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginTop: '0.5rem'
          }}>
            <div>Join Futrix WhatsApp Community to earn <strong style={{ color: 'var(--teal)' }}>+100 XP</strong> points instantly!</div>
            <a 
              href="https://chat.whatsapp.com/EuQwlgresyD4fYxrxXJAjc" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                color: 'var(--primary-btn)',
                textDecoration: 'none',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.color = 'var(--primary)'}
              onMouseOut={(e) => e.target.style.color = 'var(--primary-btn)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.517 2.266 2.27 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.45 5.426-.003 9.885-4.464 9.888-9.89.002-2.628-1.02-5.1-2.871-6.955C16.386 1.904 13.9 1.9 12.01 1.9c-5.433 0-9.892 4.457-9.896 9.886-.002 1.765.467 3.491 1.357 5.025l-.989 3.607 3.693-.968z" />
              </svg>
              Join WhatsApp Community
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default InstructionScreen;
