import React, { useEffect, useState } from 'react';

const Header = ({ 
  mode = 'register', 
  tagline = 'Ready to pilot your career?', 
  xpPoints = 0, 
  seriesId = '#FX-0001',
  countdownTime = null,
  user = null,
  onEndTest = null,
  onLogout = null
}) => {
  // Instructions page count-up timer state
  const [upSeconds, setUpSeconds] = useState(0);

  useEffect(() => {
    if (mode !== 'instruction') return;
    const interval = setInterval(() => {
      setUpSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [mode]);

  const formatUpTime = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const formatDownTime = (s) => {
    if (s === null || s === undefined) return '00:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (mode === 'register' || mode === 'login') {
    return (
      <header>
        <a href="#" className="logo" onClick={e => e.preventDefault()}>Fut<span>rix</span></a>
        <div className="header-right">
          <span className="header-tagline">{tagline}</span>
          
          {mode === 'register' && (
            <div className="xp-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              {xpPoints} XP
            </div>
          )}
        </div>
      </header>
    );
  }

  if (mode === 'instruction') {
    return (
      <header className="topbar">
        <a href="#" className="logo" onClick={e => e.preventDefault()}>Fut<span>rix</span></a>
        
        <div className="topbar-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{formatUpTime(upSeconds)}</span>
        </div>

        <div className="topbar-right">
          <div className="user-avatar-btn" onClick={onLogout} title="Click to Logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </header>
    );
  }

  if (mode === 'exam') {
    return (
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a href="#" className="logo" onClick={e => e.preventDefault()}>Fut<span>rix</span></a>
          <div className="series-id">{seriesId}</div>
        </div>

        <div className={`timer-badge ${countdownTime <= 300 ? 'warning' : ''}`} id="timerBadge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span id="timerDisplay">{formatDownTime(countdownTime)}</span>
        </div>

        <div className="candidate-info">
          <div className="candidate-details">
            <div className="candidate-name">{user?.name || 'Pilot'}</div>
            <div className="candidate-id">ID: {(user?.email || '').split('@')[0].toUpperCase()}</div>
          </div>
          <div className="avatar">{(user?.name || 'P').charAt(0).toUpperCase()}</div>
        </div>
      </header>
    );
  }

  return null;
};

export default Header;
