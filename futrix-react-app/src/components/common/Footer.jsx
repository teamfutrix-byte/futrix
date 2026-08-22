import React from 'react';

const Footer = ({ customStyle = {} }) => {
  return (
    <footer style={{
      position: 'relative',
      zIndex: 1,
      borderTop: '1px solid var(--border)',
      background: 'rgba(13, 16, 23, 0.9)',
      padding: '1.2rem 2rem',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.85rem',
      color: 'var(--text-muted)',
      ...customStyle
    }}>
      <div>Join our WhatsApp Community to get <strong>+100 XP</strong> points instantly!</div>
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
          transition: 'color 0.2s',
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
  );
};

export default Footer;
