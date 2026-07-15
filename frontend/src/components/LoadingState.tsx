import React from 'react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading details...' }) => {
  return (
    <div 
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: '16px' }}
      role="status"
      aria-live="polite"
    >
      <div className="spinner" aria-hidden="true"></div>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', fontWeight: 500 }}>{message}</p>
    </div>
  );
};
