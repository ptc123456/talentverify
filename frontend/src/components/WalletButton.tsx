import React, { useState } from 'react';
import { Wallet, LogOut, Copy, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';

export const WalletButton: React.FC = () => {
  const { address, status, error, connectWallet, disconnectWallet } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (status === 'connected' && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div 
          className="mono" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-control)',
            fontSize: '0.85rem'
          }}
        >
          <span 
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-success)',
              display: 'inline-block'
            }}
            aria-hidden="true"
          />
          <span>{formatAddress(address)}</span>
          <button 
            onClick={handleCopy}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px'
            }}
            aria-label="Copy wallet address"
          >
            {copied ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
          </button>
        </div>
        <button 
          onClick={disconnectWallet}
          className="btn"
          style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          title="Disconnect wallet connection"
        >
          <LogOut size={14} aria-hidden="true" />
          <span style={{ fontSize: '0.85rem' }}>Disconnect</span>
        </button>
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <button className="btn" disabled style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} aria-hidden="true"></div>
        <span>Connecting...</span>
      </button>
    );
  }

  let errorElement = null;
  if (error) {
    errorElement = (
      <div 
        style={{ 
          fontSize: '0.75rem', 
          color: 'var(--color-danger)', 
          marginTop: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          maxWidth: '220px',
          wordBreak: 'break-word'
        }}
      >
        <AlertTriangle size={12} style={{ flexShrink: 0 }} />
        <span>{error}</span>
      </div>
    );
  }

  if (status === 'wallet_unavailable') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <button 
          onClick={() => window.open('https://metamask.io/download/', '_blank')}
          className="btn btn-danger" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <AlertCircle size={16} aria-hidden="true" />
          <span>Install MetaMask</span>
        </button>
        {errorElement}
      </div>
    );
  }

  if (status === 'permission_rejected') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <button 
          onClick={connectWallet} 
          className="btn" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
        >
          <Wallet size={16} aria-hidden="true" />
          <span>Retry Connection</span>
        </button>
        {errorElement}
      </div>
    );
  }

  if (status === 'wrong_network') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <button 
          onClick={connectWallet} 
          className="btn btn-danger" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          title="Wallet is on incorrect network. Click to switch to GenLayer Studionet."
        >
          <AlertCircle size={16} aria-hidden="true" />
          <span>Switch Network</span>
        </button>
        {errorElement}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <button 
        onClick={connectWallet} 
        className="btn btn-primary"
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Wallet size={16} aria-hidden="true" />
        <span>Connect Wallet</span>
      </button>
      {errorElement}
    </div>
  );
};
