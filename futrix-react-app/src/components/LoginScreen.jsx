import React, { useState, useEffect } from 'react';
import Header from './common/Header';
import { APPS_SCRIPT_URL, jsonpRequest } from '../utils/api';

const LoginScreen = ({ onNavigate, onShowToast, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [errorText, setErrorText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load email if rememberMe was active
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('futrix_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (_) {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorText('');

    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedEmail || !trimmedPhone) {
      setErrorText('Please enter both your Email Address and Mobile Number.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorText('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    let data = null;
    try {
      data = await jsonpRequest(APPS_SCRIPT_URL, { email: trimmedEmail, phone: trimmedPhone });
    } catch (err) {
      console.warn('JSONP login error, trying fetch fallback...', err);
    }

    if (!data) {
      // Plain fetch fallback
      try {
        const url = `${APPS_SCRIPT_URL}?email=${encodeURIComponent(trimmedEmail)}&phone=${encodeURIComponent(trimmedPhone)}`;
        const res = await fetch(url, { redirect: 'follow' });
        const text = await res.text();
        const cleaned = text.trim()
          .replace(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, '')
          .replace(/\)\s*;?\s*$/, '');
        data = JSON.parse(cleaned);
      } catch (fetchErr) {
        console.error('Fetch fallback login failed:', fetchErr);
      }
    }

    setIsLoading(false);

    if (!data) {
      setErrorText('Unable to connect to the server. Please check your connection and try again.');
      return;
    }

    if (data.success) {
      if (rememberMe) {
        localStorage.setItem('futrix_email', trimmedEmail);
      } else {
        localStorage.removeItem('futrix_email');
      }

      const userData = {
        name: data.name || 'Pilot',
        email: data.email || trimmedEmail,
        phone: data.phone || trimmedPhone,
        xp: parseFloat(data.xp || 100),
        referralXp: parseFloat(data.referralXp || 0),
      };

      onLoginSuccess(userData);
      onShowToast(`Welcome back, ${userData.name}! 🚀`, 'success');
      onNavigate('instruction');
    } else {
      setErrorText(data.message || 'The Email Address or Mobile Number you entered is incorrect. Please try again.');
    }
  };

  return (
    <div className="login-page-container">
      <Header mode="login" tagline="Secure Login Portal" />

      {/* Login Card */}
      <div className="login-card">
        <h1 className="card-title">Welcome Back<br />Candidate</h1>
        <p className="card-sub">Login to continue your test journey</p>

        {/* Error Banner */}
        {errorText && (
          <div className="error-msg show" id="errorMsg">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span id="errorText">{errorText}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            {/* Email */}
            <div className="input-wrap">
              <input 
                type="email" 
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorText(''); }}
                placeholder="Email Address" 
                autoComplete="email" 
              />
            </div>
            {/* Mobile / Password */}
            <div className="input-wrap">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/[^0-9+\-\s()]/g, '')); setErrorText(''); }}
                placeholder="Mobile Number / Password" 
                autoComplete="current-password"
                maxLength="15" 
              />
              <button 
                type="button" 
                className="eye-btn" 
                onClick={() => setShowPassword(prev => !prev)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg id="eyeOpen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg id="eyeClosed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Options Row */}
          <div className="row-options">
            <label className="remember-label">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <a href="#" className="forgot-link" onClick={e => e.preventDefault()}>Forgot ID?</a>
          </div>

          {/* Submit */}
          <button type="submit" className="btn-login" disabled={isLoading}>
            {!isLoading ? (
              <>
                <span id="btnText">Login to Dashboard</span>
                <span className="arrow" id="btnArrow">→</span>
              </>
            ) : (
              <div className="spinner" style={{ display: 'block' }}></div>
            )}
          </button>
        </form>

        <hr className="divider" />

        <p className="card-footer">
          Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('register'); }}>Request Access</a>
        </p>

        {/* Security badges */}
        <div className="security-badges">
          <div className="badge-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Secure Session
          </div>
          <div className="badge-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            AES-256
          </div>
        </div>
      </div>

      {/* Page Footer */}
      <div className="page-footer">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
          <span>Join WhatsApp Community to earn <strong style={{ color: 'var(--primary)' }}>+100 XP</strong> points instantly!</span>
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
              gap: '0.35rem',
              fontSize: '0.82rem',
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.color = '#7caaff'}
            onMouseOut={(e) => e.target.style.color = 'var(--primary-btn)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.517 2.266 2.27 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.45 5.426-.003 9.885-4.464 9.888-9.89.002-2.628-1.02-5.1-2.871-6.955C16.386 1.904 13.9 1.9 12.01 1.9c-5.433 0-9.892 4.457-9.896 9.886-.002 1.765.467 3.491 1.357 5.025l-.989 3.607 3.693-.968z" />
            </svg>
            Join WhatsApp Community
          </a>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          fontSize: '0.65rem',
          color: 'rgba(255,255,255,0.2)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginTop: '0.4rem'
        }}>
          <div className="footer-line"></div>
          Proctor System V4.2.0
          <div className="footer-line"></div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
