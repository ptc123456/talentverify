import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Calendar, ArrowLeft, RefreshCw } from 'lucide-react';
import { getContractAddress, readClient } from '../lib/genlayer';
import { parseAttestationsJson } from '../lib/parsers';
import { Attestation } from '../types/domain';
import { VerdictBadge } from '../components/VerdictBadge';
import { EmptyState } from '../components/EmptyState';
import { getErrorMessage } from '../lib/transactions';

export const CredentialsPage: React.FC = () => {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();

  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isValidAddress = typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address);

  let contractAddr = '';
  let configError: string | null = null;
  try {
    contractAddr = getContractAddress();
  } catch (err: unknown) {
    configError = getErrorMessage(err);
  }

  const loadAttestations = useCallback(async () => {
    if (!isValidAddress || configError) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const responseStr = await readClient.readContract({
        address: contractAddr as `0x${string}`,
        functionName: 'get_attestations',
        args: [address],
      }) as string;

      const parsed = parseAttestationsJson(responseStr);
      setAttestations(parsed);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err) || 'Failed to load credentials history from contract');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddr, configError, isValidAddress]);

  useEffect(() => {
    loadAttestations();
  }, [loadAttestations]);

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (!isValidAddress) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <AlertCircle size={24} style={{ color: 'var(--color-danger)' }} />
          <span>Invalid Address Format</span>
        </h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: '16px' }}>
          The provided developer wallet address is malformed. Wallet addresses must follow the 20-byte hex format (0x...).
        </p>
        <button onClick={() => navigate('/')} className="btn btn-primary">Return Home</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => navigate(-1)} className="btn" style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
          Developer Attestations Registry
        </h1>
      </div>

      <div className="card" style={{ backgroundColor: 'var(--color-surface)', borderBottom: '3px solid var(--color-accent)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Wallet Query Address:</p>
        <p className="mono" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-ink)', marginTop: '4px' }}>
          {address}
        </p>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} style={{ color: 'var(--color-danger)' }} />
            <span>Connection Failure</span>
          </h3>
          <p style={{ color: 'var(--color-muted)', marginBottom: '16px' }}>{error}</p>
          <button onClick={loadAttestations} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {isLoading && (
        <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <div>
            <div className="spinner" style={{ marginBottom: '12px' }}></div>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Querying attestations index...</p>
          </div>
        </div>
      )}

      {!isLoading && !error && attestations.length === 0 && (
        <EmptyState 
          title="No Finalized Attestations" 
          description="This developer address does not currently have any finalized skill attestations registered on Studionet." 
        />
      )}

      {!isLoading && !error && attestations.length > 0 && (
        <div className="credentials-grid">
          {attestations.map((att) => (
            <div key={att.request_id} className="credential-item">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{att.skill} Attestation</h3>
                  <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                    (Request #{att.request_id})
                  </span>
                </div>
                
                <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>
                  GitHub Account: <strong>@{att.github_username}</strong>
                </p>

                <div className="reason-box">
                  <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', fontStyle: 'normal' }}>AI Reasoning Verdict:</p>
                  <span>{att.reason}</span>
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    <span>Verified: {formatDate(att.evaluated_at)}</span>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end', flexShrink: 0 }}>
                <VerdictBadge verdict={att.verdict} />
                <Link to={`/requests/${att.request_id}`} className="btn" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                  View Full Evidence
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
