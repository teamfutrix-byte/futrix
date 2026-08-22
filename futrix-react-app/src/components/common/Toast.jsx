import React, { useEffect } from 'react';

const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const icons = { error: '❌', success: '✅', info: 'ℹ️' };

  return (
    <div
      id="toast"
      className={`show ${type === 'error' ? 'error' : type === 'success' ? 'success-toast' : ''}`}
      role="alert"
      aria-live="polite"
    >
      {icons[type]} {message}
    </div>
  );
};

export default Toast;
