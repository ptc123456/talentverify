import React from 'react';
import { ExternalLink, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { NormalizedTransactionInfo } from '../lib/transactions';
import { NETWORK } from '../config/network';

interface TransactionTimelineProps {
  txInfo: NormalizedTransactionInfo | null;
  customMessage?: string;
}

export const TransactionTimeline: React.FC<TransactionTimelineProps> = ({ txInfo, customMessage }) => {
  if (!txInfo) return null;

  const { hash, status, result, errorReason, isFinalized, isSuccess, validators } = txInfo;
  const explorerUrl = `${NETWORK.explorerUrl}/transactions/${hash}`;

  const isState = (s: string) => status === s;

  // Determine current active/completed statuses
  const isPending = isState('PENDING');
  const isProposing = isState('PROPOSING') || isState('COMMITTING') || isState('APPEAL_COMMITTING');
  const isConsensus = isState('REVEALING') || isState('ACCEPTED') || isState('READY_TO_FINALIZE') || isState('APPEAL_REVEALING');
  
  const hasFailed = status === 'CANCELED' || status === 'UNDETERMINED' || status === 'LEADER_TIMEOUT' || status === 'VALIDATORS_TIMEOUT' || (isFinalized && !isSuccess);

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isFinalized && !hasFailed && <RefreshCw size={16} className="spinner" aria-hidden="true" />}
          {isSuccess && <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} aria-hidden="true" />}
          {hasFailed && <AlertCircle size={16} style={{ color: 'var(--color-danger)' }} aria-hidden="true" />}
          <span>On-Chain Transaction Monitor</span>
        </h3>
        <a 
          href={explorerUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
        >
          <span>View on Explorer</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          Transaction Hash: <span className="mono" style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{hash}</span>
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '4px' }}>
          Current Status: <span className="mono" style={{ color: hasFailed ? 'var(--color-danger)' : 'var(--color-accent)', fontWeight: 700 }}>{status || 'AWAITING_SDK'}</span>
        </p>
        {customMessage && (
          <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-accent)', marginTop: '6px' }}>
            {customMessage}
          </p>
        )}
      </div>

      <div className="timeline" aria-live="polite">
        {/* Step 1: Initiated */}
        <div className={`timeline-step ${isPending ? 'active' : 'completed'}`}>
          <div className="timeline-dot"></div>
          <div className="timeline-content">
            <div className="timeline-title">Transaction Initiated</div>
            <div className="timeline-desc">Transaction submitted to the GenLayer Studionet RPC queue.</div>
          </div>
        </div>

        {/* Step 2: Proposing / Block Building */}
        <div className={`timeline-step ${isProposing ? 'active' : (isPending ? '' : 'completed')}`}>
          <div className="timeline-dot"></div>
          <div className="timeline-content">
            <div className="timeline-title">Consensus Block Proposal</div>
            <div className="timeline-desc">
              {isProposing ? 'Leader node is proposing block, running non-deterministic prompts.' : 'Block proposed and committed by leader node.'}
            </div>
          </div>
        </div>

        {/* Step 3: LLM Consensus gathering */}
        <div className={`timeline-step ${isConsensus ? 'active' : ((isPending || isProposing) ? '' : 'completed')}`}>
          <div className="timeline-dot"></div>
          <div className="timeline-content">
            <div className="timeline-title">Validator Attestation & Appeal</div>
            <div className="timeline-desc">
              {isConsensus 
                ? `Running validator validation checks (state: ${status}).` 
                : 'Validators checked for semantic equivalence.'}
            </div>
          </div>
        </div>

        {/* Step 4: Finalization */}
        <div className={`timeline-step ${isFinalized ? (isSuccess ? 'completed' : 'failed') : (hasFailed ? 'failed' : '')}`}>
          <div className="timeline-dot"></div>
          <div className="timeline-content">
            <div className="timeline-title">Finalization & Execution Status</div>
            <div className="timeline-desc">
              {isFinalized 
                ? (isSuccess 
                  ? 'Transaction finalized successfully. Consensus reached!' 
                  : `Finalized with consensus/execution failure: ${errorReason}`)
                : (hasFailed 
                  ? `Transaction execution failed or was canceled: ${errorReason || status}`
                  : 'Awaiting block finalization.')}
            </div>

            {isFinalized && result && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                <p>Consensus Decision: <strong>{result}</strong></p>
                {validators && <p>Validators Involved: <strong>{validators.length}</strong></p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
