import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description }) => {
  return (
    <div 
      className="card" 
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 24px' }}
      role="status"
    >
      <Inbox size={48} style={{ marginBottom: '16px', color: 'var(--color-muted)' }} aria-hidden="true" />
      <h3 style={{ marginBottom: '8px', fontWeight: 600 }}>{title}</h3>
      <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', maxWidth: '400px' }}>{description}</p>
    </div>
  );
};
