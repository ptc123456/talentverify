import React from 'react';
import { Header } from './Header';
import { getContractAddress } from '../lib/genlayer';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  let contractAddr = '';
  try {
    contractAddr = getContractAddress();
  } catch (_) {
    // leave empty if not configured
  }

  return (
    <div className="app-container">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header />
      <main id="main-content" className="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="footer" role="contentinfo">
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontWeight: 600 }}>TalentVerify Registry Console</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            Disclaimer: TalentVerify is an evidence-backed skill attestation registry operating on GenLayer Studionet (Chain ID 61999). 
            Attestations are generated using non-deterministic AI verification of user-submitted public repository signals. 
            TalentVerify does NOT prove real-world identity, code authorship, employment history, or absolute developer capability.
          </p>
          {contractAddr && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '8px' }}>
              Powered by GenLayer Intelligent Contracts &bull; Contract Address: <span className="mono">{contractAddr}</span>
            </p>
          )}
        </div>
      </footer>
    </div>
  );
};
