'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #08090d)',
      color: 'var(--fg, #f0f0f5)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Something went wrong
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--muted, #9ca3af)', marginBottom: '1.5rem', maxWidth: '24rem', lineHeight: 1.6 }}>
        The page encountered an error. This is usually temporary — try reloading.
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '0.75rem',
          border: 'none',
          background: 'linear-gradient(135deg, #10b981, #34d399)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
