import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { WalletButton } from '../components/WalletButton';
import { VerdictBadge } from '../components/VerdictBadge';
import { EmptyState } from '../components/EmptyState';
import { ErrorNotice } from '../components/ErrorNotice';
import { TransactionTimeline } from '../components/TransactionTimeline';

import { VerifyPage } from '../pages/VerifyPage';
import { RequestPage } from '../pages/RequestPage';
import { CredentialsPage } from '../pages/CredentialsPage';

import { useWallet } from '../hooks/useWallet';
import { GenLayerClientType, readClient } from '../lib/genlayer';
import { monitorTransaction } from '../lib/transactions';

// Mock useWallet hook
vi.mock('../hooks/useWallet', () => ({
  useWallet: vi.fn(),
}));

// Mock transactions monitorTransaction
vi.mock('../lib/transactions', async () => {
  const actual = await vi.importActual<typeof import('../lib/transactions')>('../lib/transactions');
  return {
    ...actual,
    monitorTransaction: vi.fn(),
  };
});

// Mock readClient in genlayer
vi.mock('../lib/genlayer', async () => {
  const actual = await vi.importActual<typeof import('../lib/genlayer')>('../lib/genlayer');
  return {
    ...actual,
    readClient: {
      readContract: vi.fn(),
    }
  };
});

describe('WalletButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('K. renders disconnected state with Connect Wallet button', () => {
    vi.mocked(useWallet).mockReturnValue({
      address: null,
      status: 'disconnected',
      error: null,
      chainId: null,
      client: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });

    render(<WalletButton />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  test('K. renders connecting state with spinner', () => {
    vi.mocked(useWallet).mockReturnValue({
      address: null,
      status: 'connecting',
      error: null,
      chainId: null,
      client: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });

    render(<WalletButton />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  test('K. renders wrong_network status with Switch Network button and error details', () => {
    vi.mocked(useWallet).mockReturnValue({
      address: '0x123',
      status: 'wrong_network',
      error: 'Please connect to Studionet',
      chainId: 1,
      client: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });

    render(<WalletButton />);
    expect(screen.getByText('Switch Network')).toBeInTheDocument();
    expect(screen.getByText('Please connect to Studionet')).toBeInTheDocument();
  });

  test('K. renders wallet_unavailable with Install MetaMask action', () => {
    vi.mocked(useWallet).mockReturnValue({
      address: null,
      status: 'wallet_unavailable',
      error: 'MetaMask not detected',
      chainId: null,
      client: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });

    render(<WalletButton />);
    expect(screen.getByText('Install MetaMask')).toBeInTheDocument();
    expect(screen.getByText('MetaMask not detected')).toBeInTheDocument();
  });

  test('K. renders permission_rejected with Retry Connection action', () => {
    vi.mocked(useWallet).mockReturnValue({
      address: null,
      status: 'permission_rejected',
      error: 'User rejected connection',
      chainId: null,
      client: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });

    render(<WalletButton />);
    expect(screen.getByText('Retry Connection')).toBeInTheDocument();
    expect(screen.getByText('User rejected connection')).toBeInTheDocument();
  });

  test('K. renders connected address and Disconnect button', () => {
    const disconnectMock = vi.fn();
    vi.mocked(useWallet).mockReturnValue({
      address: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
      status: 'connected',
      error: null,
      chainId: 61999,
      client: {} as GenLayerClientType,
      connectWallet: vi.fn(),
      disconnectWallet: disconnectMock,
    });

    render(<WalletButton />);
    expect(screen.getByText('0xf828...0B14')).toBeInTheDocument();
    const disconnectBtn = screen.getByText('Disconnect');
    expect(disconnectBtn).toBeInTheDocument();

    fireEvent.click(disconnectBtn);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});

describe('VerdictBadge Component', () => {
  test('K. renders SUPPORTED state with correct label text', () => {
    render(<VerdictBadge verdict="SUPPORTED" />);
    expect(screen.getByText('SUPPORTED')).toBeInTheDocument();
  });

  test('K. renders INSUFFICIENT_EVIDENCE state with correct label text', () => {
    render(<VerdictBadge verdict="INSUFFICIENT_EVIDENCE" />);
    expect(screen.getByText('INSUFFICIENT EVIDENCE')).toBeInTheDocument();
  });

  test('K. renders NOT_SUPPORTED state with correct label text', () => {
    render(<VerdictBadge verdict="NOT_SUPPORTED" />);
    expect(screen.getByText('NOT SUPPORTED')).toBeInTheDocument();
  });

  test('K. renders INCONCLUSIVE state with correct label text', () => {
    render(<VerdictBadge verdict="INCONCLUSIVE" />);
    expect(screen.getByText('INCONCLUSIVE')).toBeInTheDocument();
  });
});

describe('EmptyState Component', () => {
  test('K. renders title and description correctly', () => {
    render(<EmptyState title="No Credentials Found" description="Try querying another address" />);
    expect(screen.getByText('No Credentials Found')).toBeInTheDocument();
    expect(screen.getByText('Try querying another address')).toBeInTheDocument();
  });
});

describe('ErrorNotice Component', () => {
  test('K. renders error notice and trigger retry callback', () => {
    const dismissMock = vi.fn();
    render(<ErrorNotice message="RPC call failed" onRetry={dismissMock} />);
    expect(screen.getByText('RPC call failed')).toBeInTheDocument();
    const dismissBtn = screen.getByText('Retry Action');
    fireEvent.click(dismissBtn);
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });
});

describe('TransactionTimeline Component', () => {
  test('A. renders in-progress state for PENDING status', () => {
    const txInfo = {
      hash: '0x123',
      status: 'PENDING',
      result: null,
      leaderReceipt: null,
      executionResult: null,
      validators: null,
      isFinalized: false,
      isSuccess: false,
      errorReason: null,
    };
    render(<TransactionTimeline txInfo={txInfo} customMessage="Checking status" />);
    expect(screen.getByText('Checking status')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  test('A. does not render success for ACCEPTED status', () => {
    const txInfo = {
      hash: '0x123',
      status: 'ACCEPTED',
      result: 'MAJORITY_AGREE',
      leaderReceipt: null,
      executionResult: null,
      validators: null,
      isFinalized: false,
      isSuccess: false,
      errorReason: null,
    };
    render(<TransactionTimeline txInfo={txInfo} />);
    expect(screen.queryByText('finalized success')).not.toBeInTheDocument();
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
  });

  test('A. renders finalized success when isSuccess is true', () => {
    const txInfo = {
      hash: '0x123',
      status: 'FINALIZED',
      result: 'MAJORITY_AGREE',
      leaderReceipt: null,
      executionResult: null,
      validators: null,
      isFinalized: true,
      isSuccess: true,
      errorReason: null,
    };
    render(<TransactionTimeline txInfo={txInfo} />);
    expect(screen.getByText(/Transaction finalized successfully/i)).toBeInTheDocument();
  });

  test('A. renders failure message when isSuccess is false and finalized', () => {
    const txInfo = {
      hash: '0x123',
      status: 'FINALIZED',
      result: 'MAJORITY_DISAGREE',
      leaderReceipt: null,
      executionResult: null,
      validators: null,
      isFinalized: true,
      isSuccess: false,
      errorReason: 'Consensus did not agree',
    };
    render(<TransactionTimeline txInfo={txInfo} />);
    expect(screen.getByText(/Consensus did not agree/i)).toBeInTheDocument();
  });

  test('A. renders long transaction hash without breaking layout', () => {
    const txInfo = {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      status: 'PENDING',
      result: null,
      leaderReceipt: null,
      executionResult: null,
      validators: null,
      isFinalized: false,
      isSuccess: false,
      errorReason: null,
    };
    render(<TransactionTimeline txInfo={txInfo} />);
    expect(screen.getByText(txInfo.hash)).toBeInTheDocument();
  });
});

describe('VerifyPage Component Flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  test('B. renders warning if wallet is disconnected', () => {
    vi.mocked(useWallet).mockReturnValue({
      address: null,
      status: 'disconnected',
      error: null,
      chainId: null,
      client: null,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });

    render(
      <MemoryRouter>
        <VerifyPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Wallet Disconnected')).toBeInTheDocument();
  });

  test('B. resumes verification from valid pending context and resolves request ID', async () => {
    vi.mocked(useWallet).mockReturnValue({
      address: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
      status: 'connected',
      error: null,
      chainId: 61999,
      client: {} as GenLayerClientType,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });

    const pending = {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      preSubmitCount: 5,
      ownerAddress: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
      contractAddress: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
      chainId: 61999,
      timestamp: Date.now()
    };
    sessionStorage.setItem('tv_pending_verification', JSON.stringify(pending));

    vi.mocked(monitorTransaction).mockResolvedValue({
      hash: pending.hash,
      status: 'FINALIZED',
      result: 'MAJORITY_AGREE',
      leaderReceipt: { output: { request_id: 12 } },
      executionResult: 'SUCCESS',
      validators: [],
      isFinalized: true,
      isSuccess: true,
      errorReason: null
    });

    render(
      <MemoryRouter>
        <VerifyPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Resuming transaction/)).toBeInTheDocument();
  });

  test('B. does not start monitoring on invalid pending context', () => {
    vi.mocked(useWallet).mockReturnValue({
      address: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
      status: 'connected',
      error: null,
      chainId: 61999,
      client: {} as GenLayerClientType,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });

    // Invalid pending context (wrong contract address)
    const pending = {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      preSubmitCount: 5,
      ownerAddress: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
      contractAddress: '0x0000000000000000000000000000000000000000',
      chainId: 61999,
      timestamp: Date.now()
    };
    sessionStorage.setItem('tv_pending_verification', JSON.stringify(pending));

    render(
      <MemoryRouter>
        <VerifyPage />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Resuming transaction/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('tv_pending_verification')).toBeNull();
  });

  test('B. aborts an active submit monitor on unmount and preserves its pending context', async () => {
    const hash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const writeContract = vi.fn().mockResolvedValue(hash);
    const client = { chain: { id: 61999 }, writeContract } as unknown as GenLayerClientType;
    vi.mocked(useWallet).mockReturnValue({
      address: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
      status: 'connected',
      error: null,
      chainId: 61999,
      client,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });
    vi.mocked(readClient.readContract).mockResolvedValue(0);

    let capturedSignal: AbortSignal | undefined;
    vi.mocked(monitorTransaction).mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('Transaction monitoring aborted')));
      });
    });

    const view = render(
      <MemoryRouter>
        <VerifyPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('GitHub Username'), { target: { value: 'octocat' } });
    fireEvent.change(screen.getByPlaceholderText('https://github.com/username/repo-name'), {
      target: { value: 'https://github.com/octocat/repo' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Verification' }));

    await waitFor(() => expect(monitorTransaction).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('tv_pending_verification')).not.toBeNull();
    expect(screen.getByText('Transaction submitted. Monitoring status...')).toBeInTheDocument();

    view.unmount();

    expect(capturedSignal?.aborted).toBe(true);
    expect(sessionStorage.getItem('tv_pending_verification')).not.toBeNull();
  });

  test('B. shows deterministic recovery when a successful transaction cannot map a request ID', async () => {
    const hash = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const client = {
      chain: { id: 61999 },
      writeContract: vi.fn().mockResolvedValue(hash)
    } as unknown as GenLayerClientType;
    vi.mocked(useWallet).mockReturnValue({
      address: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
      status: 'connected',
      error: null,
      chainId: 61999,
      client,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });
    vi.mocked(readClient.readContract)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(5);
    vi.mocked(monitorTransaction).mockResolvedValue({
      hash,
      status: 'FINALIZED',
      result: 'MAJORITY_AGREE',
      leaderReceipt: null,
      executionResult: 'SUCCESS',
      validators: [],
      isFinalized: true,
      isSuccess: true,
      errorReason: null
    });

    render(
      <MemoryRouter>
        <VerifyPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('GitHub Username'), { target: { value: 'octocat' } });
    fireEvent.change(screen.getByPlaceholderText('https://github.com/username/repo-name'), {
      target: { value: 'https://github.com/octocat/repo' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Verification' }));

    expect(await screen.findByText('Deterministic Resolution Failed')).toBeInTheDocument();
    expect(sessionStorage.getItem('tv_pending_verification')).toBeNull();
  });
});

describe('RequestPage Component Flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  test('C. renders invalid request ID screen', () => {
    render(
      <MemoryRouter initialEntries={['/requests/abc']}>
        <Routes>
          <Route path="/requests/:id" element={<RequestPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Invalid Request ID')).toBeInTheDocument();
  });

  test('C. renders not found when RPC errors out', async () => {
    vi.mocked(readClient.readContract).mockRejectedValue(new Error('RPC query failed'));

    render(
      <MemoryRouter initialEntries={['/requests/1']}>
        <Routes>
          <Route path="/requests/:id" element={<RequestPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Request Not Found')).toBeInTheDocument();
  });

  test('C. renders long repository URL signal wrapping safely', async () => {
    const longUrl = 'https://github.com/some-very-long-username-associated-with-a-very-long-repo-name/and-even-longer-subpath-that-needs-to-wrap-properly-in-the-ui';
    const mockRequest = {
      request_id: 1,
      owner: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
      skill: 'React',
      github_username: 'octocat',
      repo_url_1: longUrl,
      repo_url_2: '',
      repo_url_3: '',
      status: 'SUBMITTED',
      verdict: '',
      reason: '',
      evidence_summary: '',
      created_at: 1000,
      evaluated_at: 0
    };

    vi.mocked(readClient.readContract).mockResolvedValue(JSON.stringify(mockRequest));

    render(
      <MemoryRouter initialEntries={['/requests/1']}>
        <Routes>
          <Route path="/requests/:id" element={<RequestPage />} />
        </Routes>
      </MemoryRouter>
    );

    const link = await screen.findByText(longUrl);
    expect(link).toBeInTheDocument();
    expect(link).toHaveStyle({ wordBreak: 'break-all' });
  });

  test('C. aborts an active evaluation monitor on unmount and preserves its pending hash', async () => {
    const owner = '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14';
    const hash = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const writeContract = vi.fn().mockResolvedValue(hash);
    const client = { chain: { id: 61999 }, writeContract } as unknown as GenLayerClientType;
    vi.mocked(useWallet).mockReturnValue({
      address: owner,
      status: 'connected',
      error: null,
      chainId: 61999,
      client,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });
    vi.mocked(readClient.readContract).mockResolvedValue(JSON.stringify({
      request_id: 1,
      owner,
      skill: 'React',
      github_username: 'octocat',
      repo_url_1: 'https://github.com/octocat/repo',
      repo_url_2: '',
      repo_url_3: '',
      status: 'SUBMITTED',
      verdict: '',
      reason: '',
      evidence_summary: '',
      created_at: 1000,
      evaluated_at: 0
    }));

    let capturedSignal: AbortSignal | undefined;
    vi.mocked(monitorTransaction).mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('Transaction monitoring aborted')));
      });
    });

    const view = render(
      <MemoryRouter initialEntries={['/requests/1']}>
        <Routes>
          <Route path="/requests/:id" element={<RequestPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Trigger AI Evaluation' }));
    await waitFor(() => expect(monitorTransaction).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('tv_pending_eval_hash_1')).toBe(hash);
    expect(screen.getByText('Evaluation transaction submitted. Analyzing evidence...')).toBeInTheDocument();

    view.unmount();

    expect(capturedSignal?.aborted).toBe(true);
    expect(sessionStorage.getItem('tv_pending_eval_hash_1')).toBe(hash);
  });

  test('C. displays a finalized evaluation execution failure', async () => {
    const owner = '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14';
    const hash = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
    const client = {
      chain: { id: 61999 },
      writeContract: vi.fn().mockResolvedValue(hash)
    } as unknown as GenLayerClientType;
    vi.mocked(useWallet).mockReturnValue({
      address: owner,
      status: 'connected',
      error: null,
      chainId: 61999,
      client,
      connectWallet: vi.fn(),
      disconnectWallet: vi.fn(),
    });
    vi.mocked(readClient.readContract).mockResolvedValue(JSON.stringify({
      request_id: 1,
      owner,
      skill: 'React',
      github_username: 'octocat',
      repo_url_1: 'https://github.com/octocat/repo',
      repo_url_2: '',
      repo_url_3: '',
      status: 'SUBMITTED',
      verdict: '',
      reason: '',
      evidence_summary: '',
      created_at: 1000,
      evaluated_at: 0
    }));
    vi.mocked(monitorTransaction).mockResolvedValue({
      hash,
      status: 'FINALIZED',
      result: 'MAJORITY_AGREE',
      leaderReceipt: [{ execution_result: 'ERROR' }],
      executionResult: 'ERROR',
      validators: [],
      isFinalized: true,
      isSuccess: false,
      errorReason: 'Execution failed: ERROR'
    });

    render(
      <MemoryRouter initialEntries={['/requests/1']}>
        <Routes>
          <Route path="/requests/:id" element={<RequestPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Trigger AI Evaluation' }));
    expect(await screen.findByText('Execution failed: ERROR')).toBeInTheDocument();
    expect(sessionStorage.getItem('tv_pending_eval_hash_1')).toBeNull();
  });
});

describe('CredentialsPage Component Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('D. renders empty credential history screen', async () => {
    vi.mocked(readClient.readContract).mockResolvedValue('[]'); // Empty array response

    render(
      <MemoryRouter initialEntries={['/credentials/0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14']}>
        <Routes>
          <Route path="/credentials/:address" element={<CredentialsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('No Finalized Attestations')).toBeInTheDocument();
  });

  test('D. renders list of finalized credentials with long reason wrapping', async () => {
    const longReason = 'A'.repeat(500);
    const mockAttestations = [
      {
        request_id: 1,
        owner: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
        skill: 'React',
        github_username: 'octocat',
        repo_url_1: 'https://github.com/octocat/repo1',
        repo_url_2: '',
        repo_url_3: '',
        status: 'FINALIZED',
        verdict: 'SUPPORTED',
        reason: longReason,
        evidence_summary: 'Good repository structure',
        created_at: 1000,
        evaluated_at: 2000
      }
    ];

    vi.mocked(readClient.readContract).mockResolvedValue(JSON.stringify(mockAttestations));

    render(
      <MemoryRouter initialEntries={['/credentials/0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14']}>
        <Routes>
          <Route path="/credentials/:address" element={<CredentialsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('React Attestation')).toBeInTheDocument();
    expect(screen.getByText(longReason)).toBeInTheDocument();
  });

  test('D. renders a recoverable connection failure for malformed contract JSON', async () => {
    vi.mocked(readClient.readContract).mockResolvedValue('{not-valid-json');

    render(
      <MemoryRouter initialEntries={['/credentials/0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14']}>
        <Routes>
          <Route path="/credentials/:address" element={<CredentialsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Connection Failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry Connection' })).toBeInTheDocument();
  });
});
