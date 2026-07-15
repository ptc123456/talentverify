import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { WalletButton } from './WalletButton';

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-section">
          <NavLink to="/" className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <Shield size={24} style={{ color: 'var(--color-accent)' }} aria-hidden="true" />
            <span style={{ fontWeight: 800, letterSpacing: '-0.5px' }}>TalentVerify</span>
            <span className="brand-beta" aria-label="Beta Stage">Studionet</span>
          </NavLink>
        </div>

        <nav className="nav-links" aria-label="Main Navigation">
          <NavLink 
            to="/" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            end
          >
            Home
          </NavLink>
          <NavLink 
            to="/verify" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Verify a Skill
          </NavLink>
        </nav>

        <div>
          <WalletButton />
        </div>
      </div>
    </header>
  );
};
