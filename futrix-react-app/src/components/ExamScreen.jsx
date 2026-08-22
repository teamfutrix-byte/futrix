import React, { useState, useEffect, useRef } from 'react';
import Header from './common/Header';
import { APPS_SCRIPT_URL, jsonpRequest, plainFetch } from '../utils/api';

const ExamScreen = ({ user, onNavigate, onShowToast, onUpdateXP }) => {
  // Config
  const [examConfig, setExamConfig] = useState({
    seriesId: '#FX-0001',
    questions: 20,
    duration: 30,
    maxMarks: 20
  });

  // Questions & Answers States
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({});
  const [visited, setVisited] = useState({ 0: true });

  // Timer
  const [timeLeft, setTimeLeft] = useState(1800);
  const timerRef = useRef(null);

  // Layout Flow States: 'loading' | 'error' | 'ready' | 'running' | 'submitting' | 'result'
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [isExitWarningOpen, setIsExitWarningOpen] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [showMoreReport, setShowMoreReport] = useState(false);

  // Result statistics
  const [results, setResults] = useState({ correct: 0, wrong: 0, skipped: 0, score: 0 });

  // Load configuration & questions on mount
  useEffect(() => {
    const savedConfig = sessionStorage.getItem('futrix_exam_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setExamConfig(parsed);
      setTimeLeft(parsed.duration * 60);
    }

    const loadQuestions = async () => {
      let data = null;
      try {
        data = await jsonpRequest(APPS_SCRIPT_URL, { action: 'questions' });
      } catch (err) {
        console.warn('JSONP questions load failed, trying plain fetch...', err);
        try {
          const url = `${APPS_SCRIPT_URL}?action=questions`;
          const res = await fetch(url);
          const txt = await res.text();
          const cleaned = txt.trim().replace(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, '').replace(/\)\s*;?\s*$/, '');
          data = JSON.parse(cleaned);
        } catch (fetchErr) {
          console.error('Fetch questions failed:', fetchErr);
        }
      }

      if (data && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
        setQuestions(data.questions);
        setStatus('ready');
      } else {
        const msg = data ? data.message : 'Failed to connect to the server.';
        setErrorMsg(msg || 'No questions found in database.');
        setStatus('error');
      }
    };

    loadQuestions();
  }, []);

  // Secure Sandbox
  useEffect(() => {
    if (status !== 'running') return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && status === 'running' && !isExitWarningOpen) {
        setIsExitWarningOpen(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && status === 'running' && !isExitWarningOpen) {
        setIsExitWarningOpen(true);
      }
    };

    const handleWindowBlur = () => {
      if (status === 'running' && !isExitWarningOpen) {
        setIsExitWarningOpen(true);
      }
    };

    const handleBeforeUnload = (e) => {
      if (status === 'running') {
        e.preventDefault();
        e.returnValue = 'Exam is in progress. Are you sure you want to leave?';
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [status, isExitWarningOpen]);

  // Countdown timer hook
  useEffect(() => {
    if (status !== 'running') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [status]);

  const requestSandboxFullscreen = () => {
    const docEl = document.documentElement;
    const requestFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
    
    if (requestFS) {
      requestFS.call(docEl)
        .then(() => {
          setStatus('running');
        })
        .catch(err => {
          console.warn('Fullscreen request rejected, launching test anyway:', err);
          setStatus('running');
        });
    } else {
      setStatus('running');
    }
  };

  const handleResumeFullscreen = () => {
    setIsExitWarningOpen(false);
    const docEl = document.documentElement;
    const requestFS = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
    if (requestFS && !document.fullscreenElement) {
      requestFS.call(docEl).catch(err => console.warn('Fullscreen resume failed:', err));
    }
  };

  const handleConfirmExit = () => {
    setIsExitWarningOpen(false);
    executeSubmit();
  };

  const selectAnswer = (label) => {
    setAnswers(prev => ({ ...prev, [currentQ]: label }));
  };

  const clearAnswer = () => {
    setAnswers(prev => {
      const next = { ...prev };
      delete next[currentQ];
      return next;
    });
  };

  const toggleMark = () => {
    setMarked(prev => ({ ...prev, [currentQ]: !prev[currentQ] }));
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      goToQuestion(currentQ + 1);
    } else {
      setIsSubmitDialogOpen(true);
    }
  };

  const handlePrev = () => {
    if (currentQ > 0) {
      goToQuestion(currentQ - 1);
    }
  };

  const goToQuestion = (idx) => {
    setCurrentQ(idx);
    setVisited(prev => ({ ...prev, [idx]: true }));
  };

  const handleAutoSubmit = () => {
    onShowToast('Time limit exceeded. Submitting test...', 'info');
    executeSubmit();
  };

  const handleManualSubmit = () => {
    setIsSubmitDialogOpen(false);
    executeSubmit();
  };

  const executeSubmit = async () => {
    setStatus('submitting');
    clearInterval(timerRef.current);

    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    questions.forEach((q, i) => {
      const ans = answers[i];
      if (!ans) {
        skipped++;
      } else if (ans === q.correct) {
        correct++;
      } else {
        wrong++;
      }
    });

    const score = parseFloat((correct * 1 - wrong * 0.25).toFixed(2));
    const xpEarned = score;
    const timeTaken = (examConfig.duration * 60) - timeLeft;

    const payload = {
      candidateName: user.name || '',
      candidateEmail: user.email || '',
      candidatePhone: user.phone || '',
      seriesId: examConfig.seriesId,
      answers: JSON.stringify(answers),
      correct,
      wrong,
      skipped,
      score,
      xpEarned,
      totalQuestions: questions.length,
      timeTaken
    };

    try {
      await jsonpRequest(APPS_SCRIPT_URL, { action: 'submit', ...payload });
    } catch (e) {
      try {
        const params = Object.keys(payload)
          .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(payload[k])}`)
          .join('&');
        await fetch(`${APPS_SCRIPT_URL}?action=submit&${params}`);
      } catch (e2) {
        console.warn('Backend logging failed:', e2);
      }
    }

    try {
      const userEmail = (user.email || '').toLowerCase().trim();
      localStorage.setItem(`attempted_${userEmail}_${examConfig.seriesId}`, 'true');
      onUpdateXP(xpEarned);
    } catch (e) {
      console.warn('Local storage lock failed:', e);
    }

    setResults({ correct, wrong, skipped, score });
    setStatus('result');

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  };

  const handleReturnToDashboard = () => {
    onNavigate('instruction');
  };

  const answeredCount = Object.keys(answers).length;
  const progressPercent = questions.length ? (answeredCount / questions.length) * 100 : 0;
  const currentQObj = questions[currentQ];

  if (status === 'loading') {
    return (
      <div id="loadingScreen" className="screen-overlay">
        <div className="loading-spinner" id="loadingSpinner"></div>
        <div className="loading-text" id="loadingText">Retrieving Sandbox Exam Questions...</div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div id="loadingScreen" className="screen-overlay" style={{ padding: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>⚠️</div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: '1.1rem', fontWeight: 700, color: '#e1e2ec', marginBottom: '0.5rem' }}>
          Failed to load questions
        </div>
        <div style={{ fontSize: '0.82rem', color: '#6b7280', maxWidth: '380px', textAlign: 'center', lineHeight: 1.6, marginBottom: '1.4rem' }}>
          {errorMsg}
        </div>
        <div style={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1rem 1.4rem', maxWidth: '400px', textAlign: 'left', fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.8, marginBottom: '1.2rem' }}>
          <b style={{ color: '#e1e2ec' }}>How to Update Apps Script:</b><br />
          1. Open Google Apps Script (Extensions → Apps Script)<br />
          2. Paste the entire updated script into Code.gs (refer to Apps_Script_Code.js)<br />
          3. Deploy → Manage Deployments → Edit → Choose "New version" → Deploy<br /><br />
          <b style={{ color: '#e1e2ec' }}>Prepare Google Sheet Tabs:</b><br />
          4. Create a sheet tab named <b style={{ color: '#adc6ff' }}>"Questions"</b> in your Google Sheet<br />
          5. Structure columns as: Q.No | Question | OptA | OptB | OptC | OptD | Correct | Marks | Negative
        </div>
        <button 
          onClick={() => window.location.reload()} 
          style={{ padding: '0.7rem 2rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#4d8eff,#6fa3ff)', color: '#fff', fontFamily: "'Sora',sans-serif", fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div id="loadingScreen" className="screen-overlay" style={{ padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>🎯</div>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: '1.3rem', fontWeight: 700, color: '#e1e2ec', marginBottom: '0.5rem' }}>
          Sandbox Ready!
        </div>
        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '480px', lineHeight: 1.6, marginBottom: '2rem' }}>
          To start the test, please launch in secure sandbox mode. This will lock your browser into fullscreen to prevent tab switching and unauthorized exits.
        </div>
        <button 
          onClick={requestSandboxFullscreen}
          style={{
            padding: '0.95rem 2rem',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #4d8eff, #6fa3ff)',
            color: '#fff',
            fontFamily: "'Sora',sans-serif",
            fontSize: '1.05rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(77, 142, 255, 0.4)',
            transition: 'transform 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          🚀 Enter Secure Exam Mode
        </button>
      </div>
    );
  }

  if (status === 'submitting') {
    return (
      <div className="screen-overlay">
        <div className="loading-spinner"></div>
        <div className="loading-text">Saving responses and compiling XP score...</div>
      </div>
    );
  }

  if (status === 'result') {
    return (
      <div id="resultScreen" className="result-screen show">
        <div className="logo" style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '1rem', marginBottom: '0.5rem', display: 'inline-block' }}>Fut<span>rix</span></div>
        <div className="result-card">
          <div className="result-title">Exam Submitted! 🎉</div>
          <p className="result-sub">Your responses have been saved successfully.</p>
          
          <div className="result-score-ring">
            <div className="result-score-lbl" style={{ marginBottom: '0.15rem' }}>Score</div>
            <div className="result-score-val" id="res-score" style={{ lineHeight: 1.1 }}>{results.score.toFixed(2)}</div>
            <div className="result-score-lbl" id="res-score-lbl" style={{ marginTop: '0.15rem' }}>Out of {questions.length}</div>
          </div>
          
          <div style={{
            textAlign: 'center',
            margin: '-0.5rem 0 1.2rem',
            fontFamily: "'Sora',sans-serif",
            fontSize: '1rem',
            fontWeight: 700,
            color: results.score >= 0 ? '#4ade80' : '#f87171'
          }} id="res-xp">
            {(results.score >= 0 ? '+' : '') + results.score.toFixed(2)} XP
          </div>

          <div className="result-grid">
            <div className="result-stat green">
              <div className="result-stat-val" id="res-correct">{results.correct}</div>
              <div className="result-stat-lbl">Correct (+1 XP each)</div>
            </div>
            
            <div className="result-stat red">
              <div className="result-stat-val" id="res-wrong">{results.wrong}</div>
              <div className="result-stat-lbl">Wrong (-0.25 XP each)</div>
            </div>

            <div className="result-stat">
              <div className="result-stat-val" id="res-skipped">{results.skipped}</div>
              <div className="result-stat-lbl">Skipped</div>
            </div>
          </div>

          {/* Premium Report Box */}
          <div style={{
            background: 'rgba(77,142,255,0.06)',
            border: '1px solid rgba(77,142,255,0.2)',
            borderRadius: '14px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
            fontSize: '0.85rem',
            lineHeight: '1.6',
            color: 'var(--text)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', fontFamily: "'Sora', sans-serif", fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>
              <span>👑</span> Detailed Performance Report
            </div>
            
            <p style={{ marginBottom: '0.8rem', fontWeight: 600 }}>Want your detailed performance report instantly?</p>
            
            {/* Read More Button (shown only when collapsed) */}
            {!showMoreReport && (
              <div style={{ textAlign: 'center', margin: '0.5rem 0 0.2rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowMoreReport(true)}
                  style={{
                    background: 'rgba(77, 142, 255, 0.08)',
                    border: '1px dashed var(--primary)',
                    color: 'var(--primary)',
                    padding: '0.4rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: "'Sora', sans-serif",
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(77, 142, 255, 0.15)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(77, 142, 255, 0.08)'; }}
                >
                  <span>📖</span> Read More Details
                </button>
              </div>
            )}

            {/* Collapsible Details Panel */}
            {showMoreReport && (
              <div style={{ transition: 'all 0.3s ease' }}>
                <p style={{ margin: '0.8rem 0 0.4rem', color: 'var(--primary)', fontWeight: 600 }}>🚀 Upgrade to the Premium Report Plan and get immediate access to:</p>
                
                <ul style={{ listStyle: 'none', paddingLeft: '0.2rem', marginBottom: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <li>✅ Subject-wise Analysis</li>
                  <li>✅ Accuracy Report</li>
                  <li>✅ Performance Insights</li>
                  <li>✅ Strengths & Weaknesses</li>
                  <li>✅ Improvement Recommendations</li>
                </ul>
                
                <p style={{ marginBottom: '0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
                  🏫 Students enrolled through a FUTRIX-registered coaching institute do not need to purchase the Premium Report for coaching review.
                </p>
                
                <p style={{ marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Your detailed performance report will be shared with your registered coaching institute free of cost within 7 days.
                </p>
                
                <div style={{ background: 'rgba(255, 169, 77, 0.07)', border: '1px solid rgba(255, 169, 77, 0.2)', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.8rem' }}>
                  <strong style={{ color: 'var(--accent)' }}>⚡ Need your report right now?</strong><br />
                  Upgrade to Premium and unlock instant access.
                </div>

                {/* Hide Button (shown only when expanded at the bottom of the content) */}
                <div style={{ textAlign: 'center', margin: '0.5rem 0 0' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowMoreReport(false)}
                    style={{
                      background: 'rgba(77, 142, 255, 0.08)',
                      border: '1px dashed var(--primary)',
                      color: 'var(--primary)',
                      padding: '0.4rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(77, 142, 255, 0.15)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(77, 142, 255, 0.08)'; }}
                  >
                    <span>📖</span> Hide Details
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="btn-home" onClick={handleReturnToDashboard}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  // Core Exam Board layout
  return (
    <div className="exam-page-container">
      <Header 
        mode="exam" 
        user={user}
        seriesId={examConfig.seriesId} 
        countdownTime={timeLeft} 
        onEndTest={() => setIsSubmitDialogOpen(true)}
      />

      <div className="exam-layout" id="examLayout">
        {/* Left Side: Question */}
        <div className="question-panel">
          <div className="q-header">
            <div className="q-number" id="qNumber">Question {currentQ + 1}</div>
            <div className="marks-badge">
              <span id="marksPos">+{currentQObj?.marks || 1} Marks</span> | <em id="marksNeg">{currentQObj?.negative || -0.25} Negative</em>
            </div>
          </div>

          <div className="q-box">
            <p className="q-text" id="qText">{currentQObj?.question}</p>
          </div>

          <div className="options-list" id="optionsList">
            {['A', 'B', 'C', 'D'].map((lbl) => {
              const optText = currentQObj?.[`option${lbl}`];
              if (!optText) return null;
              const isSelected = answers[currentQ] === lbl;

              return (
                <button
                  key={lbl}
                  className={`option-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => selectAnswer(lbl)}
                >
                  <div className="option-label">{lbl}</div>
                  <span>{optText}</span>
                </button>
              );
            })}
          </div>

          <div className="nav-bar">
            <button className="btn-nav" id="btnPrev" disabled={currentQ === 0} onClick={handlePrev}>◀ Previous</button>
            <button className={`btn-nav btn-mark ${marked[currentQ] ? 'active' : ''}`} id="btnMark" onClick={toggleMark}>
              {marked[currentQ] ? '★ Marked' : 'Mark for Review'}
            </button>
            <button className="btn-nav" onClick={clearAnswer}>Clear Response</button>
            <button className="btn-nav btn-save" id="btnNext" onClick={handleNext}>
              {currentQ === questions.length - 1 ? 'Save & Finish ✓' : 'Save & Next ▶'}
            </button>
          </div>
        </div>

        {/* Right Side: Palette */}
        <div className="palette-panel">
          <div className="palette-header">Question Palette</div>

          <div className="palette-legend">
            <div className="legend-item"><div className="legend-dot ld-answered"></div> Answered</div>
            <div className="legend-item"><div className="legend-dot ld-not-visited"></div> Not Visited</div>
            <div className="legend-item"><div className="legend-dot ld-review"></div> Review</div>
            <div className="legend-item"><div className="legend-dot ld-current"></div> Current</div>
          </div>

          <div className="palette-grid-wrap">
            <div className="palette-grid" id="paletteGrid">
              {questions.map((_, i) => {
                let statusClass = '';
                if (i === currentQ) statusClass = 'current';
                else if (answers[i] && marked[i]) statusClass = 'ans-review';
                else if (answers[i]) statusClass = 'answered';
                else if (marked[i]) statusClass = 'review';

                return (
                  <button
                    key={i}
                    id={`pb-${i}`}
                    className={`p-btn ${statusClass}`}
                    onClick={() => goToQuestion(i)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="palette-footer">
            <div className="progress-label">Overall Progress</div>
            <div className="progress-bar">
              <div className="progress-fill" id="progressFill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <button className="btn-submit" id="btnSubmit" onClick={() => setIsSubmitDialogOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Submit Test
            </button>
          </div>
        </div>
      </div>

      {/* Exit Warning Dialog */}
      <div className={`dialog-overlay ${isExitWarningOpen ? 'show' : ''}`} id="exitWarnDialog">
        <div className="dialog-box">
          <div className="dialog-icon" style={{ color: 'var(--danger)' }}>⚠️</div>
          <div className="dialog-title" style={{ color: 'var(--danger)', fontFamily: "'Sora', sans-serif", fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.6rem' }}>Sandbox Exit Warning</div>
          <div className="dialog-msg" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Are you sure you want to end the test? Exiting fullscreen or switching tabs is not allowed. Click "No" to return to the test, or "Yes" to submit and exit.
          </div>
          <div className="dialog-actions" style={{ display: 'flex', gap: '0.8rem' }}>
            <button className="dialog-cancel" id="confirmNoExit" onClick={handleResumeFullscreen} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--answered)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              No, Stay in Test
            </button>
            <button className="dialog-confirm" id="confirmYesExit" onClick={handleConfirmExit} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              Yes, End Test
            </button>
          </div>
        </div>
      </div>

      {/* Manual Submit Confirmation Dialog */}
      <div className={`dialog-overlay ${isSubmitDialogOpen ? 'show' : ''}`} id="submitDialog">
        <div className="dialog-box">
          <div className="dialog-icon">⚠️</div>
          <div className="dialog-title">Submit Exam?</div>
          <div className="dialog-msg">Are you sure you want to submit? You cannot change answers after submission.</div>
          <div className="dialog-stats">
            <div className="dialog-stat">
              <div className="dialog-stat-val" id="dlg-answered" style={{ color: '#4ade80' }}>{answeredCount}</div>
              <div className="dialog-stat-lbl">Answered</div>
            </div>
            <div className="dialog-stat">
              <div className="dialog-stat-val" id="dlg-review" style={{ color: '#fbbf24' }}>{Object.keys(marked).length}</div>
              <div className="dialog-stat-lbl">For Review</div>
            </div>
            <div className="dialog-stat">
              <div className="dialog-stat-val" id="dlg-unanswered" style={{ color: '#f87171' }}>{questions.length - answeredCount}</div>
              <div className="dialog-stat-lbl">Not Answered</div>
            </div>
          </div>
          <div className="dialog-actions">
            <button className="dialog-cancel" id="cancelSubmit" onClick={() => setIsSubmitDialogOpen(false)}>Cancel</button>
            <button className="dialog-confirm" id="confirmSubmit" onClick={handleManualSubmit}>Submit Now</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamScreen;
