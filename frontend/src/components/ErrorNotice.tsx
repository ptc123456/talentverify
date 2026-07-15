import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorNoticeProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorNotice: React.FC<ErrorNoticeProps> = ({ title = 'An error occurred', message, onRetry }) => {
  return (
    <div 
      className="notice-banner danger" 
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
      <div style={{ flex: 1 }}>
        <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>{title}</h4>
        <p style={{ fontSize: '0.85rem' }}>{message}</p>
        {onRetry && (
          <button 
            onClick={onRetry} 
            className="btn btn-primary" 
            style={{ marginTop: '12px', padding: '6px 12px', fontSize: '0.8rem' }}
          >
            Retry Action
          </button>
        )}
      </div>
    </div>
  );
};
