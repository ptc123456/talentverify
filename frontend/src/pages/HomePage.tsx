import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, Cpu, Code2, AlertTriangle } from 'lucide-react';
import { NETWORK } from '../config/network';
import { getContractAddress } from '../lib/genlayer';
import { getErrorMessage } from '../lib/transactions';

export const HomePage: React.FC = () => {
  const [addressInput, setAddressInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  let contractAddr = '';
  let configError: string | null = null;
  try {
    contractAddr = getContractAddress();
  } catch (err: unknown) {
    configError = getErrorMessage(err);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = addressInput.trim();
    if (!trimmed) {
      setError('Please enter a wallet address');
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setError('Please enter a valid 20-byte Ethereum-style address (0x...)');
      return;
    }
    navigate(`/credentials/${trimmed}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {configError && (
        <div className="notice-banner danger" role="alert">
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontWeight: 600 }}>System Configuration Error</h4>
            <p style={{ fontSize: '0.85rem' }}>{configError}</p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section style={{ padding: '40px 0', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: '16px' }}>
          Decentralized Skill Attestation Registry
        </h1>
        <p style={{ fontSize: '1.15rem', color: 'var(--color-muted)', maxWidth: '800px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
          TalentVerify is an evidence-first, AI-adjudicated verification console. We evaluate public GitHub repository signals on-chain to attest developer competency in core programming languages and frameworks.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => navigate('/verify')} 
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 600 }}
            disabled={!!configError}
          >
            Verify a Skill Now
          </button>
        </div>
      </section>

      {/* Search Section */}
      <section className="card" style={{ maxWidth: '650px', width: '100%', margin: '0 auto' }}>
        <h2 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={20} style={{ color: 'var(--color-accent)' }} />
          <span>Lookup Attestation Registry</span>
        </h2>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="address-search" className="form-label">Developer Wallet Address</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                id="address-search"
                type="text" 
                className="form-input mono" 
                placeholder="e.g. 0x98...a52"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                style={{ flex: 1 }}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "search-error" : undefined}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }}>Search</button>
            </div>
            {error && <p className="form-error" id="search-error"><AlertTriangle size={14} /> {error}</p>}
          </div>
        </form>
      </section>

      {/* Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Features Card */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Cpu size={18} style={{ color: 'var(--color-accent)' }} />
            <span>How AI-Adjudication Works</span>
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', marginBottom: '12px', lineHeight: 1.6 }}>
            Rather than relying on central authorities or manual resume reviews, TalentVerify uses GenLayer 
            <strong> Intelligent Contracts</strong>. When a verification is requested:
          </p>
          <ul style={{ fontSize: '0.9rem', color: 'var(--color-muted)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.6 }}>
            <li><strong>Submission:</strong> The developer submits their claimed skill and up to 3 GitHub repository URLs.</li>
            <li><strong>AI Consensus:</strong> Multiple LLM validators independently execute code checks and analyze the codebase evidence against the target skill.</li>
            <li><strong>Optimistic Democracy:</strong> The on-chain consensus engine determines if the majority of validators agree, recording the finalized verdict and raw reasoning on-chain.</li>
          </ul>
        </div>

        {/* Info Box */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Code2 size={18} style={{ color: 'var(--color-accent)' }} />
            <span>Supported Skills for Attestation</span>
          </h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {['React', 'TypeScript', 'Python', 'Solidity', 'Rust'].map(s => (
              <span key={s} className="badge badge-success" style={{ textTransform: 'none', padding: '6px 12px' }}>{s}</span>
            ))}
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
            Only public repositories matching the target language or framework codebase structure will be accepted. 
            Code in forks, boilerplate repos, empty files, or templates is considered weak evidence.
          </p>
        </div>
      </div>

      {/* Network and Disclaimer Footer */}
      <section className="notice-banner info" style={{ margin: 0 }}>
        <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ fontWeight: 600 }}>Active GenLayer Network Target</h4>
          <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
            Console is connected to <strong>GenLayer Studionet</strong> (Chain ID: {NETWORK.chainId}) at RPC: <span className="mono">{NETWORK.rpcUrl}</span>.
          </p>
          {contractAddr && (
            <p style={{ fontSize: '0.85rem' }}>
              Contract Address: <span className="mono" style={{ fontWeight: 600 }}>{contractAddr}</span>
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
