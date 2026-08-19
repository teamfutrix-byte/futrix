import React, { useState, useEffect } from 'react';
import Header from './common/Header';
import Footer from './common/Footer';
import FloatingOrbs from './common/FloatingOrbs';
import { FORM_ACTION, APPS_SCRIPT_URL, ENTRY, jsonpRequest } from '../utils/api';

const RegisterScreen = ({ onNavigate, onShowToast }) => {
  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [instituteName, setInstituteName] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [otherExam, setOtherExam] = useState('');
  const [referral, setReferral] = useState('');

  // Email Verification States
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState({
    name: false,
    email: false,
    phone: false,
    dob: false,
    guardianName: false,
    guardianContact: false,
    city: false,
    institute: false,
    pinCode: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Animated counters
  const [counters, setCounters] = useState({ pilots: 0, tests: 0, xp: 0 });

  useEffect(() => {
    // Animate counters
    const duration = 2000;
    const steps = duration / 16;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      setCounters({
        pilots: Math.min(Math.round((124502 / steps) * step), 124502),
        tests: Math.min(Math.round((2400000 / steps) * step), 2400000),
        xp: Math.min(Math.round((1200000000 / steps) * step), 1200000000)
      });
      if (step >= steps) clearInterval(interval);
    }, 16);

    return () => clearInterval(interval);
  }, []);

  const formatCounter = (val, type) => {
    if (type === 'M') return (val / 1000).toFixed(1) + 'M';
    if (type === 'B') return (val / 1000000000).toFixed(1) + 'B';
    return val.toLocaleString();
  };

  const handlePhoneChange = (val) => {
    setPhone(val.replace(/[^0-9+\-\s()]/g, ''));
    setErrors(prev => ({ ...prev, phone: false }));
  };

  const handleDobChange = (val) => {
    let value = val.replace(/\D/g, '');
    if (value.length > 8) {
      value = value.slice(0, 8);
    }
    let formatted = '';
    if (value.length > 0) formatted += value.substring(0, 2);
    if (value.length > 2) formatted += '/' + value.substring(2, 4);
    if (value.length > 4) formatted += '/' + value.substring(4, 8);
    setDob(formatted);
    setErrors(prev => ({ ...prev, dob: false }));
  };

  const isValidDOB = (dobStr) => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)) return false;
    const parts = dobStr.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) return false;
    if (month < 1 || month > 12) return false;
    
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    if (day < 1 || day > monthDays[month - 1]) return false;
    
    const today = new Date();
    const birthDate = new Date(year, month - 1, day);
    if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) {
      return false;
    }
    if (birthDate > today) return false;
    
    return true;
  };

  // Cooldown timer effect
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => {
      setOtpCooldown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  const isFakePhone = (val) => {
    const clean = val.replace(/[^0-9]/g, '');
    if (clean.length !== 10) return true;
    if (!/^[6-9]/.test(clean)) return true;
    if (/(\d)\1{4,}/.test(clean)) return true;
    if (/^(\d{2})\1{4}$/.test(clean)) return true;
    if (/^(\d{3})\1{2}\d$/.test(clean)) return true;
    const sequentialUp = "0123456789";
    const sequentialDown = "9876543210";
    if (sequentialUp.indexOf(clean) !== -1 || sequentialDown.indexOf(clean) !== -1) return true;
    const testPatterns = [
      "1234512345", "9876598765", "6789067890", "1234567890", "0123456789", 
      "9876543210", "8765432109", "7654321098", "6543210987", "5432109876"
    ];
    if (testPatterns.indexOf(clean) !== -1) return true;
    return false;
  };

  const submitRegistration = async () => {
    setIsLoading(true);
    try {
      const prepValue = selectedExam;
      const regParams = {
        action: 'register',
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        dob: dob.trim(),
        guardianName: guardianName.trim(),
        guardianContact: guardianContact.trim(),
        city: city.trim(),
        instituteName: instituteName.trim(),
        pinCode: pinCode.trim(),
        preparation: prepValue,
        referral: referral.trim()
      };

      let regRes = null;
      try {
        regRes = await jsonpRequest(APPS_SCRIPT_URL, regParams);
      } catch (err) {
        console.warn('JSONP registration failed, trying fetch fallback...', err);
        try {
          const url = `${APPS_SCRIPT_URL}?${new URLSearchParams(regParams).toString()}`;
          const res = await fetch(url, { redirect: 'follow' });
          const txt = await res.text();
          const cleaned = txt.trim().replace(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, '').replace(/\)\s*;?\s*$/, '');
          regRes = JSON.parse(cleaned);
        } catch (fetchErr) {
          console.error('Fetch registration fallback also failed:', fetchErr);
        }
      }

      if (regRes && regRes.success) {
        setIsSuccess(true);
        onShowToast(`Welcome aboard, ${fullName.split(' ')[0]}! 🚀`, 'success');
      } else {
        onShowToast(regRes ? regRes.message : 'Registration failed. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Submission error:', err);
      onShowToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors(prev => ({ ...prev, email: true }));
      onShowToast('Please enter a valid email address first.', 'error');
      return;
    }
    
    setIsOtpSending(true);
    try {
      const res = await jsonpRequest(APPS_SCRIPT_URL, { action: 'sendOTP', email: email.trim(), phone: phone.trim() });
      if (res && res.success) {
        onShowToast('OTP verification code sent to your email!', 'success');
        setIsOtpSent(true);
        setOtp('');
        setIsOtpModalOpen(true);
        setOtpCooldown(60);
      } else {
        onShowToast(res ? res.message : 'Failed to send OTP. Try again.', 'error');
      }
    } catch (err) {
      console.error(err);
      onShowToast('Error sending OTP. Please check your connection.', 'error');
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.trim().length !== 6 || isNaN(otp.trim())) {
      onShowToast('Please enter a valid 6-digit OTP.', 'error');
      return;
    }
    
    setIsOtpVerifying(true);
    try {
      const res = await jsonpRequest(APPS_SCRIPT_URL, { action: 'verifyOTP', email: email.trim(), otp: otp.trim() });
      if (res && res.success) {
        onShowToast('Email verified successfully! ✓', 'success');
        setIsEmailVerified(true);
        setIsOtpModalOpen(false);
        await submitRegistration();
      } else {
        onShowToast(res ? res.message : 'Invalid OTP. Please try again.', 'error');
      }
    } catch (err) {
      console.error(err);
      onShowToast('Error verifying OTP. Please try again.', 'error');
    } finally {
      setIsOtpVerifying(false);
    }
  };

  const validate = () => {
    let valid = true;
    const newErrors = {
      name: false,
      email: false,
      phone: false,
      dob: false,
      guardianName: false,
      guardianContact: false,
      city: false,
      institute: false,
      pinCode: false
    };

    if (!fullName.trim() || fullName.trim().length < 2) {
      newErrors.name = true;
      valid = false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = true;
      valid = false;
    }

    if (!phone.trim() || isFakePhone(phone.trim())) {
      newErrors.phone = true;
      valid = false;
    }
    if (!dob.trim() || !isValidDOB(dob.trim())) {
      newErrors.dob = true;
      valid = false;
    }
    if (!guardianName.trim() || guardianName.trim().length < 2) {
      newErrors.guardianName = true;
      valid = false;
    }
    if (!guardianContact.trim() || isFakePhone(guardianContact.trim())) {
      newErrors.guardianContact = true;
      valid = false;
    }
    if (!city.trim() || city.trim().length < 2) {
      newErrors.city = true;
      valid = false;
    }

    if (!pinCode.trim() || !/^\d{6}$/.test(pinCode.trim())) {
      newErrors.pinCode = true;
      valid = false;
    }
    if (!selectedExam) {
      onShowToast('Please select your exam preparation category.', 'error');
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!isEmailVerified) {
      setIsLoading(true);
      try {
        const res = await jsonpRequest(APPS_SCRIPT_URL, { action: 'sendOTP', email: email.trim(), phone: phone.trim() });
        if (res && res.success) {
          onShowToast('OTP verification code sent to your email!', 'success');
          setIsOtpSent(true);
          setOtp('');
          setIsOtpModalOpen(true);
          setOtpCooldown(60);
        } else {
          onShowToast(res ? res.message : 'Failed to send OTP. Try again.', 'error');
        }
      } catch (err) {
        console.error(err);
        onShowToast('Error sending OTP. Please check your connection.', 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    await submitRegistration();
  };

  return (
    <div className="register-page-container">
      <FloatingOrbs />
      <Header mode="register" xpPoints={isSuccess ? 100 : 0} />

      <main>
        <div className="page-content">
          {/* Left Panel: Form */}
          <div className={`form-card ${isSuccess ? 'success-mode' : ''}`} id="formCard">
            {!isSuccess ? (
              <div className="form-body">
                <h1 className="form-title">Start Your Journey</h1>

                <div className="xp-banner">
                  <div className="xp-icon">⚡</div>
                  <div>Earn <strong>+100 XP</strong> points by completing your first test after registration.</div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="field-group">
                    {/* Full Name */}
                    <div className={`field ${errors.name ? 'error' : ''}`}>
                      <input 
                        type="text" 
                        id="fullName" 
                        value={fullName}
                        onChange={(e) => { setFullName(e.target.value); setErrors(prev => ({ ...prev, name: false })); }}
                        placeholder="e.g. Rajesh Kumar" 
                        autoComplete="name" 
                      />
                      <label htmlFor="fullName">Full Name</label>
                      <div className="field-line"></div>
                      <div className="field-error">Please enter your full name</div>
                    </div>

                    {/* Email */}
                    <div className={`field ${errors.email ? 'error' : ''}`}>
                      <input 
                        type="email" 
                        id="emailAddress" 
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: false })); }}
                        placeholder="e.g. rajesh@gmail.com" 
                        autoComplete="email" 
                        readOnly={isEmailVerified}
                      />
                      <label htmlFor="emailAddress">Email Address</label>
                      <div className="field-line"></div>
                      <div className="field-error">Please enter a valid email address</div>
                    </div>


                    {/* Phone */}
                    <div className={`field ${errors.phone ? 'error' : ''}`}>
                      <input 
                        type="tel" 
                        id="phoneNumber" 
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="e.g. 9876543210" 
                        autoComplete="tel"
                        maxLength="15" 
                      />
                      <label htmlFor="phoneNumber">Phone Number</label>
                      <div className="field-line"></div>
                      <div className="field-error">Please enter a valid phone number</div>
                    </div>

                    {/* Date Of Birth */}
                    <div className={`field ${errors.dob ? 'error' : ''}`}>
                      <input 
                        type="text" 
                        id="dob" 
                        value={dob}
                        onChange={(e) => handleDobChange(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        maxLength="10"
                      />
                      <label htmlFor="dob">Date of Birth</label>
                      <div className="field-line"></div>
                      <div className="field-error">Please enter your date of birth (DD/MM/YYYY)</div>
                    </div>

                    {/* Father's / Guardian's Name */}
                    <div className={`field ${errors.guardianName ? 'error' : ''}`}>
                      <input 
                        type="text" 
                        id="guardianName" 
                        value={guardianName}
                        onChange={(e) => { setGuardianName(e.target.value); setErrors(prev => ({ ...prev, guardianName: false })); }}
                        placeholder="e.g. Sunil Kumar" 
                      />
                      <label htmlFor="guardianName">Father's / Guardian's Name</label>
                      <div className="field-line"></div>
                      <div className="field-error">Please enter Father's / Guardian's Name</div>
                    </div>

                    {/* Father's / Guardian's Contact Number */}
                    <div className={`field ${errors.guardianContact ? 'error' : ''}`}>
                      <input 
                        type="tel" 
                        id="guardianContact" 
                        value={guardianContact}
                        onChange={(e) => { setGuardianContact(e.target.value.replace(/[^0-9+\-\s()]/g, '')); setErrors(prev => ({ ...prev, guardianContact: false })); }}
                        placeholder="e.g. 9876543210"
                        maxLength="15" 
                      />
                      <label htmlFor="guardianContact">Father's / Guardian's Contact Number</label>
                      <div className="field-line"></div>
                      <div className="field-error">Please enter a valid Father's / Guardian's Contact Number</div>
                    </div>

                    {/* City */}
                    <div className={`field ${errors.city ? 'error' : ''}`}>
                      <input 
                        type="text" 
                        id="city" 
                        value={city}
                        onChange={(e) => { setCity(e.target.value); setErrors(prev => ({ ...prev, city: false })); }}
                        placeholder="e.g. New Delhi" 
                        autoComplete="address-level2" 
                      />
                      <label htmlFor="city">City</label>
                      <div className="field-line"></div>
                      <div className="field-error">Please enter your city</div>
                    </div>

                    {/* Institute Name */}
                    <div className="field">
                      <input 
                        type="text" 
                        id="instituteName" 
                        value={instituteName}
                        onChange={(e) => { setInstituteName(e.target.value); setErrors(prev => ({ ...prev, institute: false })); }}
                        placeholder="e.g. Coaching Name,Teacher Name,College Name or Institute Name" 
                      />
                      <label htmlFor="instituteName">Institute Name (Optional)</label>
                      <div className="field-line"></div>
                    </div>

                    {/* Pin code */}
                    <div className={`field ${errors.pinCode ? 'error' : ''}`}>
                      <input 
                        type="text" 
                        id="pinCode" 
                        value={pinCode}
                        onChange={(e) => { 
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setPinCode(val); 
                          setErrors(prev => ({ ...prev, pinCode: false })); 
                        }}
                        placeholder="e.g. 110001" 
                        autoComplete="postal-code"
                        maxLength="6" 
                      />
                      <label htmlFor="pinCode">Pin code</label>
                      <div className="field-line"></div>
                      <div className="field-error">Please enter a valid 6-digit pin code</div>
                    </div>
                  </div>

                  <p className="prep-label">Preparation For</p>
                  <div className="prep-grid" role="group" aria-label="Select exam preparation">
                    {['NEET', 'JEE'].map(examName => (
                      <button
                        key={examName}
                        type="button"
                        className={`prep-btn ${selectedExam === examName ? 'selected' : ''}`}
                        onClick={() => setSelectedExam(examName)}
                      >
                        {examName}
                      </button>
                    ))}
                  </div>

                  <div className="field-group" style={{ marginTop: '1.5rem' }}>
                    {/* Referral */}
                    <div className="field">
                      <input 
                        type="text" 
                        id="referral" 
                        value={referral}
                        onChange={(e) => setReferral(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. Enter the registered mobile number of the person who Reffered you to FUTRIX." 
                      />
                      <label htmlFor="referral">If Any Refferal</label>
                      <div className="field-line"></div>
                    </div>

                    {/* XP Point */}
                    <div className="field">
                      <input 
                        type="text" 
                        id="xpPointDisplay" 
                        value="100 XP" 
                        readOnly 
                        style={{ color: 'var(--success)', fontWeight: '600' }} 
                      />
                      <label htmlFor="xpPointDisplay">XP Point (Earned on Registration)</label>
                      <div className="field-line" style={{ background: 'var(--success)', width: '100%' }}></div>
                    </div>
                  </div>

                  <button type="submit" className="btn-register" disabled={isLoading}>
                    {!isLoading ? (
                      <span>Register &amp; Continue 🚀</span>
                    ) : (
                      <div className="spinner" style={{ display: 'block' }}></div>
                    )}
                  </button>
                </form>

                <p className="form-footer">
                  Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }}>Login Pilot</a>
                </p>
              </div>
            ) : (
              <div className="success-overlay show">
                <div className="success-icon">✓</div>
                <div className="success-title">You're In, Pilot! 🎉</div>
                <p className="success-msg">Registration successful. Your journey begins now!</p>
                <div className="xp-earned">+100 XP Queued</div>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); onNavigate('login'); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    marginTop: '0.8rem', padding: '0.75rem 2rem',
                    borderRadius: '12px', textDecoration: 'none',
                    background: 'linear-gradient(135deg,#4d8eff,#6fa3ff)',
                    color: '#fff', fontFamily: "'Sora',sans-serif",
                    fontSize: '0.95rem', fontWeight: 700,
                    boxShadow: '0 4px 18px rgba(77,142,255,0.4)',
                    transition: 'transform 0.2s,box-shadow 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 28px rgba(77,142,255,0.5)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 18px rgba(77,142,255,0.4)';
                  }}
                >
                  🚀 Login to Start Test
                </a>
              </div>
            )}
          </div>

          {/* Right Panel: Hero */}
          <div className="hero-panel">
            <img 
              className="hero-image" 
              src="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=900&q=80"
              alt="Student mastering exams with futuristic holographic interface" 
              loading="lazy" 
            />
            <div className="hero-gradient"></div>

            <div className="live-indicator" aria-label="System Online">
              <div className="live-dot"></div>
              SYS. ONLINE
            </div>

            <div className="hero-xp-chip" aria-label="Potential 12k XP">
              <div className="xp-chip-icon">⭐</div>
              <div className="xp-chip-info">
                <span className="xp-chip-value">+12k</span>
                <span className="xp-chip-label">Potential XP</span>
              </div>
            </div>

            <div className="score-card">
              <div className="score-card-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                Target Score
              </div>
              <div className="score-value">98%</div>
              <div className="score-trend">↑ Current Trend: Ascending</div>
              <div className="score-bar">
                <div className="score-bar-fill"></div>
              </div>
            </div>

            <div className="hero-content">
              <h2>Master your Exams with Gamified Precision</h2>
              <p>Our platform turns every mock test into a mission. Gain experience, unlock elite ranks, and conquer competitive exams with our command-center dashboard.</p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Active Pilots</span>
            <span className="stat-value blue">{formatCounter(counters.pilots)}</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-label">Tests Completed</span>
            <span className="stat-value teal">{formatCounter(counters.tests, 'M')}</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-label">XP Generated</span>
            <span className="stat-value orange">{formatCounter(counters.xp, 'B')}</span>
          </div>
        </div>

        <Footer />
      </main>

      {/* OTP Verification Modal */}
      {isOtpModalOpen && (
        <div className="otp-modal-overlay show" onClick={(e) => { if (e.target.classList.contains('otp-modal-overlay')) setIsOtpModalOpen(false); }}>
          <div className="otp-modal-content">
            <button 
              type="button" 
              className="otp-modal-close" 
              onClick={() => setIsOtpModalOpen(false)}
            >
              &times;
            </button>
            <div className="otp-modal-header">
              <div className="otp-modal-icon">✉️</div>
              <h2>Verify Your Email</h2>
              <p>We've sent a 6-digit verification code to <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{email}</span>.<br/>Please enter it below to verify your account.</p>
            </div>
            <div className="otp-input-wrapper">
              <input 
                type="text" 
                className="otp-modal-input" 
                placeholder="••••••" 
                maxLength={6} 
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                autoComplete="one-time-code" 
              />
            </div>
            <div className="otp-timer-text">
              {otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : 'You can now resend the verification code.'}
            </div>
            <button 
              type="button" 
              className="otp-modal-btn" 
              disabled={isOtpVerifying}
              onClick={handleVerifyOTP}
            >
              <span>Verify Code</span>
              {isOtpVerifying && (
                <div className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', borderWidth: '2px', marginLeft: '0.5rem' }}></div>
              )}
            </button>
            <button 
              type="button" 
              className="otp-modal-resend" 
              disabled={otpCooldown > 0 || isOtpSending}
              onClick={handleSendOTP}
            >
              {isOtpSending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterScreen;
