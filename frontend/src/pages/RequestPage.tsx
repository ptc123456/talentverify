import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ExternalLink, Calendar, GitPullRequest, Code2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { getContractAddress, readClient } from '../lib/genlayer';
import { parseRequestJson } from '../lib/parsers';
import { VerificationRequest } from '../types/domain';
import { VerdictBadge } from '../components/VerdictBadge';
import { monitorTransaction, NormalizedTransactionInfo, getErrorMessage, isAbortError } from '../lib/transactions';
import { TransactionTimeline } from '../components/TransactionTimeline';
import { ErrorNotice } from '../components/ErrorNotice';

export const RequestPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address, client } = useWallet();

  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);

  // Evaluation states
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalTxInfo, setEvalTxInfo] = useState<NormalizedTransactionInfo | null>(null);
  const [evalMessage, setEvalMessage] = useState('');
  const [evalError, setEvalError] = useState<string | null>(null);

  // Ref to track active monitor AbortController
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const requestId = parseInt(id || '', 10);
  const isInvalidId = isNaN(requestId) || requestId <= 0 || !Number.isInteger(requestId);

  let contractAddr = '';
  let configError: string | null = null;
  try {
    contractAddr = getContractAddress();
  } catch (err: unknown) {
    configError = getErrorMessage(err);
  }

  const loadRequest = useCallback(async () => {
    if (isInvalidId || configError) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setReadError(null);

    try {
      const responseStr = await readClient.readContract({
        address: contractAddr as `0x${string}`,
        functionName: 'get_request',
        args: [requestId],
      }) as string;

      const parsed = parseRequestJson(responseStr);
      setRequest(parsed);
    } catch (err: unknown) {
      console.error(err);
      setReadError(getErrorMessage(err) || 'Failed to load request from contract');
    } finally {
      setIsLoading(false);
    }
  }, [requestId, contractAddr, configError, isInvalidId]);

  // Read request details on mount or ID changes
  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  // Restore evaluation monitoring if session refreshed
  useEffect(() => {
    const cachedHash = sessionStorage.getItem(`tv_pending_eval_hash_${requestId}`);
    if (cachedHash && client) {
      setEvalMessage('Resuming evaluation monitor from session...');
      setIsEvaluating(true);

      const abortController = new AbortController();

      const restoreEvalMonitor = async () => {
        try {
          const finalInfo = await monitorTransaction({
            hash: cachedHash,
            client,
            signal: abortController.signal,
            onStateChange: (state) => {
              setEvalTxInfo(state);
            }
          });

          if (finalInfo.isSuccess) {
            setEvalMessage('Evaluation succeeded! Reloading request state...');
            sessionStorage.removeItem(`tv_pending_eval_hash_${requestId}`);
            await loadRequest();
            setIsEvaluating(false);
          } else {
            setEvalError(finalInfo.errorReason || 'Evaluation failed on-chain');
            setIsEvaluating(false);
            sessionStorage.removeItem(`tv_pending_eval_hash_${requestId}`);
          }
        } catch (err: unknown) {
          const errMsg = getErrorMessage(err);
          if (isAbortError(err)) return;
          setEvalError(errMsg || 'Error monitoring evaluation');
          setIsEvaluating(false);
          sessionStorage.removeItem(`tv_pending_eval_hash_${requestId}`);
        }
      };

      restoreEvalMonitor();

      return () => {
        abortController.abort();
      };
    }
  }, [client, requestId, loadRequest]);

  // Clean up any active monitor controller when unmounting
  useEffect(() => {
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, []);

  const handleEvaluate = async () => {
    setEvalError(null);
    setEvalTxInfo(null);

    if (!client || !address) {
      setEvalError('Please connect your MetaMask wallet first.');
      return;
    }

    if (!request) return;

    setIsEvaluating(true);
    setEvalMessage('Awaiting wallet signature...');

    // Abort any existing active monitor controller
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    try {
      const hash = await client.writeContract({
        address: contractAddr as `0x${string}`,
        functionName: 'evaluate_request',
        args: [requestId],
        value: 0n,
      });

      if (abortController.signal.aborted) return;
      setEvalMessage('Evaluation transaction submitted. Analyzing evidence...');
      sessionStorage.setItem(`tv_pending_eval_hash_${requestId}`, hash);

      const finalState = await monitorTransaction({
        hash,
        client,
        signal: abortController.signal,
        onStateChange: (state) => {
          setEvalTxInfo(state);
        }
      });

      if (abortController.signal.aborted) return;

      if (!finalState.isSuccess) {
        throw new Error(finalState.errorReason || 'Evaluation failed on-chain');
      }

      setEvalMessage('Verification finalized! Reloading details...');
      sessionStorage.removeItem(`tv_pending_eval_hash_${requestId}`);
      
      // Reload request state
      await loadRequest();
      setIsEvaluating(false);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = getErrorMessage(err);
      if (!isAbortError(err)) {
        setEvalError(errMsg || 'Failed to trigger evaluation');
        setIsEvaluating(false);
        sessionStorage.removeItem(`tv_pending_eval_hash_${requestId}`);
      }
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null;
      }
    }
  };

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (isInvalidId) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <AlertTriangle size={24} style={{ color: 'var(--color-danger)' }} />
          <span>Invalid Request ID</span>
        </h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: '16px' }}>
          The provided request identifier is malformed. Request ID must be a positive integer.
        </p>
        <button onClick={() => navigate('/')} className="btn btn-primary">Return Home</button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '12px' }}></div>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Retrieving Request details from Studionet...</p>
        </div>
      </div>
    );
  }

  if (readError) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <AlertCircle size={24} style={{ color: 'var(--color-danger)' }} />
          <span>Request Not Found</span>
        </h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: '16px' }}>
          We could not locate Request ID #{requestId} in the smart contract registry. It may not exist yet or there was a RPC error.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={loadRequest} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} />
            <span>Retry Connection</span>
          </button>
          <button onClick={() => navigate('/')} className="btn">Return Home</button>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const isOwner = address?.toLowerCase() === request.owner.toLowerCase();
  const isSubmitted = request.status === 'SUBMITTED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {configError && (
        <div className="notice-banner danger" role="alert">
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontWeight: 600 }}>Configuration Error</h4>
            <p style={{ fontSize: '0.85rem' }}>{configError}</p>
          </div>
        </div>
      )}

      {evalError && <ErrorNotice message={evalError} onRetry={() => setEvalError(null)} />}

      {isEvaluating && evalTxInfo && (
        <TransactionTimeline txInfo={evalTxInfo} customMessage={evalMessage} />
      )}

      {isEvaluating && !evalTxInfo && (
        <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
          <div className="spinner" style={{ marginBottom: '16px' }} aria-hidden="true"></div>
          <p style={{ fontWeight: 500 }}>{evalMessage}</p>
        </div>
      )}

      {/* Main Request Meta */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitPullRequest size={20} style={{ color: 'var(--color-accent)' }} />
              <span>Verification Request #{request.request_id}</span>
            </h2>
            <div className="card-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} />
                <span>Submitted: {formatDate(request.created_at)}</span>
              </span>
              {request.status === 'FINALIZED' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={14} />
                  <span>Evaluated: {formatDate(request.evaluated_at)}</span>
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="badge badge-neutral" style={{ marginRight: '8px' }}>{request.status}</span>
            <VerdictBadge verdict={request.verdict} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {/* Metadata */}
          <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 600 }}>Developer Information</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
              GitHub Profile: <a href={`https://github.com/${request.github_username}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>@{request.github_username}</a>
            </p>
            <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
              Target Skill Attestation: <span className="badge badge-success" style={{ textTransform: 'none', padding: '2px 8px' }}>{request.skill}</span>
            </p>
            <p style={{ fontSize: '0.9rem' }}>
              Owner Address: <span className="mono" style={{ fontSize: '0.8rem' }}>{request.owner}</span>
            </p>
          </div>

          {/* Repositories */}
          <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 600 }}>Submitted Repository Signals</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[request.repo_url_1, request.repo_url_2, request.repo_url_3].filter(Boolean).map((url, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Code2 size={16} style={{ color: 'var(--color-muted)' }} />
                  <a href={url} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                    {url}
                  </a>
                  <ExternalLink size={12} style={{ color: 'var(--color-muted)' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Verdict/Results */}
          {request.status === 'FINALIZED' && (
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 600 }}>AI Consensus Analysis</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Verdict Conclusion:</p>
                <div style={{ marginTop: '4px' }}>
                  <VerdictBadge verdict={request.verdict} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Consensus Reason Text:</p>
                <div className="reason-box" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {request.reason || 'No reason text was recorded.'}
                </div>
              </div>

              {request.evidence_summary && (
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Evidence Signal Summary:</p>
                  <div className="reason-box" style={{ borderLeftColor: 'var(--color-success)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {request.evidence_summary}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Evaluate Panel */}
          {isSubmitted && (
            <div style={{ padding: '16px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-control)', border: '1px dashed var(--color-border)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>Awaiting Evaluation</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                This verification request has been successfully registered. The non-deterministic LLM analysis needs to be executed to resolve the verdict.
              </p>
              
              {isOwner ? (
                <button 
                  onClick={handleEvaluate} 
                  className="btn btn-primary"
                  disabled={isEvaluating}
                >
                  Trigger AI Evaluation
                </button>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-warning)', fontWeight: 500 }}>
                  Only the owner of this request ({request.owner.substring(0,6)}...) can trigger the on-chain evaluation.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
