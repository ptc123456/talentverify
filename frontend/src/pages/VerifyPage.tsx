import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { getContractAddress, readClient } from '../lib/genlayer';
import { validateVerifyForm, ValidationError } from '../lib/validation';
import { 
  monitorTransaction, 
  tryDecodeIdFromReceipt, 
  resolveRequestIdFromRange, 
  NormalizedTransactionInfo,
  getErrorMessage,
  isAbortError
} from '../lib/transactions';
import { 
  safeParsePendingVerificationContext, 
  PendingVerificationContext 
} from '../lib/pendingTransactions';
import { TransactionTimeline } from '../components/TransactionTimeline';
import { ErrorNotice } from '../components/ErrorNotice';

export const VerifyPage: React.FC = () => {
  const { address, status, client, connectWallet } = useWallet();
  const navigate = useNavigate();

  // Form states
  const [skill, setSkill] = useState('React');
  const [githubUsername, setGithubUsername] = useState('');
  const [repoUrl1, setRepoUrl1] = useState('');
  const [repoUrl2, setRepoUrl2] = useState('');
  const [repoUrl3, setRepoUrl3] = useState('');

  // UI state
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [txInfo, setTxInfo] = useState<NormalizedTransactionInfo | null>(null);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<number | null>(null);

  // Refs for focusing first error
  const skillRef = useRef<HTMLSelectElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const repo1Ref = useRef<HTMLInputElement>(null);
  const repo2Ref = useRef<HTMLInputElement>(null);
  const repo3Ref = useRef<HTMLInputElement>(null);

  // Ref to track active monitor AbortController
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  let contractAddr = '';
  let configError: string | null = null;
  try {
    contractAddr = getContractAddress();
  } catch (err: unknown) {
    configError = getErrorMessage(err);
  }

  // Restore transaction monitoring if session refreshed
  useEffect(() => {
    const cachedPending = sessionStorage.getItem('tv_pending_verification');
    if (cachedPending && client && address) {
      let pendingRaw: unknown = null;
      try {
        pendingRaw = JSON.parse(cachedPending);
      } catch (_) {
        sessionStorage.removeItem('tv_pending_verification');
        return;
      }

      const pending = safeParsePendingVerificationContext(pendingRaw);
      if (!pending) {
        sessionStorage.removeItem('tv_pending_verification');
        return;
      }

      // Validate matching configurations case-insensitively
      if (
        pending.ownerAddress.toLowerCase() !== address.toLowerCase() ||
        pending.contractAddress.toLowerCase() !== contractAddr.toLowerCase() ||
        (client.chain?.id && pending.chainId !== client.chain.id)
      ) {
        if (pending.ownerAddress.toLowerCase() !== address.toLowerCase()) {
          return;
        }
        sessionStorage.removeItem('tv_pending_verification');
        return;
      }

      setCustomMessage('Resuming transaction monitoring from session...');
      setIsSubmitting(true);
      
      const abortController = new AbortController();

      const restoreMonitor = async () => {
        try {
          const finalInfo = await monitorTransaction({
            hash: pending.hash,
            client,
            signal: abortController.signal,
            onStateChange: (state) => {
              setTxInfo(state);
            }
          });
          
          if (finalInfo.isSuccess) {
            setCustomMessage('Transaction finalized. Resolving Request ID...');
            await resolveRequestIdWithContext(pending, finalInfo);
          } else {
            setGeneralError(finalInfo.errorReason || 'Transaction failed on-chain');
            setIsSubmitting(false);
            sessionStorage.removeItem('tv_pending_verification');
          }
        } catch (err: unknown) {
          const errMsg = getErrorMessage(err);
          if (isAbortError(err)) return;
          setGeneralError(errMsg || 'Error monitoring restored transaction');
          setIsSubmitting(false);
          sessionStorage.removeItem('tv_pending_verification');
        }
      };

      restoreMonitor();

      return () => {
        abortController.abort();
      };
    }
  }, [client, address, contractAddr]);

  // Clean up any active monitor controller when unmounting
  useEffect(() => {
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, []);

  const getErrorForField = (field: string) => {
    return errors.find(e => e.field === field)?.message;
  };

  const focusFirstError = (errs: ValidationError[]) => {
    const firstField = errs[0]?.field;
    if (firstField === 'skill') skillRef.current?.focus();
    else if (firstField === 'github_username') usernameRef.current?.focus();
    else if (firstField === 'repo_url_1') repo1Ref.current?.focus();
    else if (firstField === 'repo_url_2') repo2Ref.current?.focus();
    else if (firstField === 'repo_url_3') repo3Ref.current?.focus();
  };

  const resolveRequestIdWithContext = async (pending: PendingVerificationContext, finalInfo: NormalizedTransactionInfo) => {
    try {
      // Look in receipt if returned by SDK
      const decodedId = tryDecodeIdFromReceipt(finalInfo.leaderReceipt);
      if (decodedId !== null) {
        sessionStorage.removeItem('tv_pending_verification');
        navigate(`/requests/${decodedId}`);
        return;
      }

      // Check post count
      const postCount = await readClient.readContract({
        address: contractAddr as `0x${string}`,
        functionName: 'get_request_count',
        args: []
      }) as number;

      // Scan only the range [preCount + 1, postCount]
      const resolved = await resolveRequestIdFromRange({
        contractAddress: contractAddr,
        preSubmitCount: pending.preSubmitCount,
        postSubmitCount: postCount,
        ownerAddress: pending.ownerAddress,
        readClient
      });

      sessionStorage.removeItem('tv_pending_verification');

      if (resolved !== null) {
        navigate(`/requests/${resolved}`);
      } else {
        setResolvedId(-1); // Triggers manual recovery path
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      setGeneralError(`Error resolving Request ID: ${getErrorMessage(err)}`);
      setIsSubmitting(false);
      sessionStorage.removeItem('tv_pending_verification');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setGeneralError(null);
    setTxInfo(null);
    setResolvedId(null);

    if (configError) {
      setGeneralError(configError);
      return;
    }

    if (status !== 'connected' || !client || !address) {
      setGeneralError('Please connect your MetaMask wallet to Studionet first.');
      return;
    }

    const { errors: formErrors, normalizedRepos } = validateVerifyForm(
      skill,
      githubUsername,
      repoUrl1,
      repoUrl2,
      repoUrl3
    );

    if (formErrors.length > 0) {
      setErrors(formErrors);
      focusFirstError(formErrors);
      return;
    }

    // Abort any existing active controller
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    setIsSubmitting(true);
    setCustomMessage('Reading pre-submit request count...');

    try {
      // 1. Read preCount
      const preCount = await readClient.readContract({
        address: contractAddr as `0x${string}`,
        functionName: 'get_request_count',
        args: []
      }) as number;

      if (abortController.signal.aborted) return;
      setCustomMessage('Awaiting wallet signature...');

      // 2. Submit writeContract (0 GEN tokens)
      const hash = await client.writeContract({
        address: contractAddr as `0x${string}`,
        functionName: 'request_verification',
        args: [
          skill,
          githubUsername.trim(),
          normalizedRepos[0] || '',
          normalizedRepos[1] || '',
          normalizedRepos[2] || ''
        ],
        value: 0n
      });

      if (abortController.signal.aborted) return;
      setCustomMessage('Transaction submitted. Monitoring status...');
      
      const pendingContext: PendingVerificationContext = {
        hash,
        preSubmitCount: preCount,
        ownerAddress: address,
        contractAddress: contractAddr,
        chainId: client.chain?.id || 61999,
        timestamp: Date.now()
      };
      sessionStorage.setItem('tv_pending_verification', JSON.stringify(pendingContext));

      // 3. Monitor transaction status
      const finalState = await monitorTransaction({
        hash,
        client,
        signal: abortController.signal,
        onStateChange: (state) => {
          setTxInfo(state);
        }
      });

      if (abortController.signal.aborted) return;

      if (!finalState.isSuccess) {
        throw new Error(finalState.errorReason || 'Transaction execution failed');
      }

      setCustomMessage('Transaction successful. Resolving on-chain Request ID...');

      await resolveRequestIdWithContext(pendingContext, finalState);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = getErrorMessage(err);
      if (!isAbortError(err)) {
        setGeneralError(errMsg || 'Error occurred while sending transaction');
        setIsSubmitting(false);
        sessionStorage.removeItem('tv_pending_verification');
      }
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null;
      }
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '24px', fontWeight: 800, letterSpacing: '-0.5px' }}>
        Skill Attestation Form
      </h1>

      {configError && (
        <div className="notice-banner danger" role="alert">
          <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontWeight: 600 }}>Configuration Error</h4>
            <p style={{ fontSize: '0.85rem' }}>{configError}</p>
          </div>
        </div>
      )}

      {generalError && <ErrorNotice message={generalError} onRetry={() => setGeneralError(null)} />}

      {isSubmitting && txInfo && (
        <TransactionTimeline txInfo={txInfo} customMessage={customMessage} />
      )}

      {isSubmitting && !txInfo && (
        <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
          <div className="spinner" style={{ marginBottom: '16px' }} aria-hidden="true"></div>
          <p style={{ fontWeight: 500 }}>{customMessage}</p>
        </div>
      )}

      {!isSubmitting && resolvedId === -1 && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} style={{ color: 'var(--color-warning)' }} />
            <span>Deterministic Resolution Failed</span>
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', marginBottom: '12px' }}>
            The transaction was finalized successfully, but we could not automatically map the Request ID to your address. 
            This can happen if multiple transactions were submitted at the same block.
          </p>
          {txInfo && (
            <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
              Transaction Hash: <span className="mono">{txInfo.hash}</span>
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => navigate('/')} className="btn">Return Home</button>
            <button onClick={() => navigate(`/credentials/${address}`)} className="btn btn-primary">Check Credentials History</button>
          </div>
        </div>
      )}

      {!isSubmitting && resolvedId !== -1 && (
        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {status !== 'connected' && (
            <div className="notice-banner warning" role="alert">
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ fontWeight: 600 }}>Wallet Disconnected</h4>
                <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                  You must connect MetaMask switching to Studionet to submit a verification request.
                </p>
                <button type="button" onClick={connectWallet} className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  Connect Wallet
                </button>
              </div>
            </div>
          )}

          {/* Skill Selection */}
          <div className="form-group">
            <label htmlFor="skill-select" className="form-label">Claimed Skill Name</label>
            <select
              id="skill-select"
              ref={skillRef}
              className="form-select"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              disabled={status !== 'connected' || !!configError}
              aria-describedby={getErrorForField('skill') ? 'skill-error' : undefined}
            >
              <option value="React">React</option>
              <option value="TypeScript">TypeScript</option>
              <option value="Python">Python</option>
              <option value="Solidity">Solidity</option>
              <option value="Rust">Rust</option>
            </select>
            <p className="form-helper">Select the primary programming skill to attestation.</p>
            {getErrorForField('skill') && (
              <p className="form-error" id="skill-error"><AlertCircle size={14} /> {getErrorForField('skill')}</p>
            )}
          </div>

          {/* GitHub Username */}
          <div className="form-group">
            <label htmlFor="username-input" className="form-label">GitHub Username</label>
            <div style={{ position: 'relative' }}>
              <input
                id="username-input"
                ref={usernameRef}
                type="text"
                className="form-input"
                placeholder="e.g. octocat"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                disabled={status !== 'connected' || !!configError}
                aria-describedby={getErrorForField('github_username') ? 'username-error' : undefined}
              />
            </div>
            <p className="form-helper">Your case-insensitive personal or organization profile username.</p>
            {getErrorForField('github_username') && (
              <p className="form-error" id="username-error"><AlertCircle size={14} /> {getErrorForField('github_username')}</p>
            )}
          </div>

          {/* Repository URLs */}
          <div className="form-group">
            <label className="form-label">GitHub Public Repository evidence (1 to 3 URLs)</label>
            <p className="form-helper" style={{ marginBottom: '10px' }}>
              Only repositories owned by you containing code matching the claimed skill will be analyzed.
            </p>

            {/* URL 1 */}
            <div style={{ marginBottom: '12px' }}>
              <input
                id="repo-input-1"
                ref={repo1Ref}
                type="text"
                className="form-input mono"
                placeholder="https://github.com/username/repo-name"
                value={repoUrl1}
                onChange={(e) => setRepoUrl1(e.target.value)}
                disabled={status !== 'connected' || !!configError}
                aria-describedby={getErrorForField('repo_url_1') ? 'repo1-error' : undefined}
              />
              {getErrorForField('repo_url_1') && (
                <p className="form-error" id="repo1-error"><AlertCircle size={14} /> {getErrorForField('repo_url_1')}</p>
              )}
            </div>

            {/* URL 2 */}
            <div style={{ marginBottom: '12px' }}>
              <input
                id="repo-input-2"
                ref={repo2Ref}
                type="text"
                className="form-input mono"
                placeholder="https://github.com/username/second-repo"
                value={repoUrl2}
                onChange={(e) => setRepoUrl2(e.target.value)}
                disabled={status !== 'connected' || !repoUrl1.trim() || !!configError}
                aria-describedby={getErrorForField('repo_url_2') ? 'repo2-error' : undefined}
              />
              {getErrorForField('repo_url_2') && (
                <p className="form-error" id="repo2-error"><AlertCircle size={14} /> {getErrorForField('repo_url_2')}</p>
              )}
            </div>

            {/* URL 3 */}
            <div>
              <input
                id="repo-input-3"
                ref={repo3Ref}
                type="text"
                className="form-input mono"
                placeholder="https://github.com/username/third-repo"
                value={repoUrl3}
                onChange={(e) => setRepoUrl3(e.target.value)}
                disabled={status !== 'connected' || !repoUrl2.trim() || !repoUrl1.trim() || !!configError}
                aria-describedby={getErrorForField('repo_url_3') ? 'repo3-error' : undefined}
              />
              {getErrorForField('repo_url_3') && (
                <p className="form-error" id="repo3-error"><AlertCircle size={14} /> {getErrorForField('repo_url_3')}</p>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={status !== 'connected' || !!configError}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <span>Submit Verification</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
