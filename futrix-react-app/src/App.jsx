import React, { useState, useEffect } from 'react';
import RegisterScreen from './components/RegisterScreen';
import LoginScreen from './components/LoginScreen';
import InstructionScreen from './components/InstructionScreen';
import ExamScreen from './components/ExamScreen';
import Toast from './components/common/Toast';

function App() {
  const [page, setPage] = useState('register');
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  // Load session storage on mount
  useEffect(() => {
    try {
      const savedUser = sessionStorage.getItem('futrix_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setPage('instruction');
      }
    } catch (_) {}
  }, []);

  // Auth Guard: redirect to login if attempting dashboard without login session
  useEffect(() => {
    if (!user && (page === 'instruction' || page === 'exam')) {
      setPage('login');
    }
  }, [page, user]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    sessionStorage.setItem('futrix_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('futrix_user');
    setPage('login');
    showToast('Logged out successfully.', 'info');
  };

  const handleUpdateXP = (earnedXP) => {
    if (!user) return;
    const updatedXP = parseFloat((user.xp + earnedXP).toFixed(2));
    const updatedUser = { ...user, xp: updatedXP };
    setUser(updatedUser);
    sessionStorage.setItem('futrix_user', JSON.stringify(updatedUser));
  };

  const closeToast = () => {
    setToast({ message: '', type: 'info' });
  };

  return (
    <>
      {page === 'register' && (
        <RegisterScreen 
          onNavigate={setPage} 
          onShowToast={showToast} 
        />
      )}

      {page === 'login' && (
        <LoginScreen 
          onNavigate={setPage} 
          onShowToast={showToast}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {page === 'instruction' && user && (
        <InstructionScreen 
          user={user}
          onNavigate={setPage}
          onShowToast={showToast}
          onLogout={handleLogout}
        />
      )}

      {page === 'exam' && user && (
        <ExamScreen 
          user={user}
          onNavigate={setPage}
          onShowToast={showToast}
          onUpdateXP={handleUpdateXP}
        />
      )}

      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={closeToast} 
      />
    </>
  );
}

export default App;
