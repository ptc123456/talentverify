import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { WalletProvider, WalletContext } from '../context/WalletContext';
import { useContext } from 'react';
import { getConnectedClient } from '../lib/genlayer';

vi.mock('../lib/genlayer', () => ({
  getConnectedClient: vi.fn(),
}));

const ADDRESS = '0x277bF20771129ae224042d23b0311C1AC5a9AC1b';
const STUDIONET_HEX = '0xf22f';

function WalletProbe() {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error('Wallet context unavailable');
  return (
    <div>
      <button onClick={wallet.connectWallet}>Connect</button>
      <span data-testid="status">{wallet.status}</span>
      <span data-testid="address">{wallet.address ?? ''}</span>
      <span data-testid="error">{wallet.error ?? ''}</span>
    </div>
  );
}

function createProvider(initialChainId = '0x1', chainInstalled = true) {
  let chainId = initialChainId;
  let installed = chainInstalled;
  const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
    if (method === 'eth_accounts') return [];
    if (method === 'eth_requestAccounts') return [ADDRESS];
    if (method === 'eth_chainId') return chainId;
    if (method === 'wallet_addEthereumChain') {
      installed = true;
      return null;
    }
    if (method === 'wallet_switchEthereumChain') {
      if (!installed) throw { code: 4902, message: 'Unknown chain' };
      chainId = (params?.[0] as { chainId: string }).chainId;
      return null;
    }
    throw new Error(`Unexpected method: ${method}`);
  });

  return {
    request,
    on: vi.fn(),
    removeListener: vi.fn(),
  } satisfies EIP1193Provider;
}

describe('WalletProvider Studionet connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConnectedClient).mockReturnValue({} as ReturnType<typeof getConnectedClient>);
  });

  afterEach(() => {
    Object.defineProperty(window, 'ethereum', { configurable: true, value: undefined });
  });

  test('switches to Studionet and creates the SDK client with the injected provider', async () => {
    const provider = createProvider();
    Object.defineProperty(window, 'ethereum', { configurable: true, value: provider });

    render(<WalletProvider><WalletProbe /></WalletProvider>);
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('connected'));
    expect(screen.getByTestId('address')).toHaveTextContent(ADDRESS);
    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIONET_HEX }],
    });
    expect(getConnectedClient).toHaveBeenCalledWith(ADDRESS, provider);
  });

  test('adds an unknown Studionet chain, switches to it, and verifies the active chain', async () => {
    const provider = createProvider('0x1', false);
    Object.defineProperty(window, 'ethereum', { configurable: true, value: provider });

    render(<WalletProvider><WalletProbe /></WalletProvider>);
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('connected'));
    expect(provider.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_addEthereumChain' }));
    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIONET_HEX }],
    });
  });

  test('shows the provider message instead of object Object for structured SDK errors', async () => {
    const provider = createProvider(STUDIONET_HEX);
    Object.defineProperty(window, 'ethereum', { configurable: true, value: provider });
    vi.mocked(getConnectedClient).mockImplementation(() => {
      throw { data: { message: 'Provider transport unavailable' } };
    });

    render(<WalletProvider><WalletProbe /></WalletProvider>);
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('wrong_network'));
    expect(screen.getByTestId('error')).toHaveTextContent('SDK Connection Error: Provider transport unavailable');
    expect(screen.getByTestId('error')).not.toHaveTextContent('[object Object]');
  });

  test('maps a rejected network switch to the permission-rejected state', async () => {
    const provider = createProvider();
    provider.request.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_accounts') return [];
      if (method === 'eth_requestAccounts') return [ADDRESS];
      if (method === 'eth_chainId') return '0x1';
      if (method === 'wallet_switchEthereumChain') {
        throw { code: 4001, message: 'User rejected the request' };
      }
      return null;
    });
    Object.defineProperty(window, 'ethereum', { configurable: true, value: provider });

    render(<WalletProvider><WalletProbe /></WalletProvider>);
    fireEvent.click(screen.getByText('Connect'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('permission_rejected'));
    expect(screen.getByTestId('error')).toHaveTextContent('User rejected the request');
  });
});
