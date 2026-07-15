import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '64px 24px' }}>
      <ShieldAlert size={64} style={{ color: 'var(--color-muted)', marginBottom: '24px' }} aria-hidden="true" />
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Page Not Found</h1>
      <p style={{ color: 'var(--color-muted)', marginBottom: '24px', maxWidth: '450px' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <button onClick={() => navigate('/')} className="btn btn-primary">
        Go to Home
      </button>
    </div>
  );
};
