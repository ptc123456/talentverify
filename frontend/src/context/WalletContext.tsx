import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getConnectedClient, GenLayerClientType } from '../lib/genlayer';
import { NETWORK } from '../config/network';

function errorMessage(error: unknown, seen = new WeakSet<object>()): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === 'object' && error !== null) {
    if (seen.has(error)) return 'Unknown wallet error';
    seen.add(error);

    const record = error as Record<string, unknown>;
    for (const key of ['shortMessage', 'message', 'details', 'reason']) {
      if (typeof record[key] === 'string' && record[key].trim()) {
        return record[key];
      }
    }
    for (const key of ['data', 'cause', 'error']) {
      if (record[key] !== undefined) {
        const nested = errorMessage(record[key], seen);
        if (nested !== 'Unknown wallet error') return nested;
      }
    }
  }

  return 'Unknown wallet error';
}

function errorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const record = error as Record<string, unknown>;
  const directCode = record.code;
  if (typeof directCode === 'number') return directCode;
  if (typeof directCode === 'string' && /^-?\d+$/.test(directCode)) {
    return Number(directCode);
  }
  return errorCode(record.data) ?? errorCode(record.cause) ?? errorCode(record.error);
}

export type WalletStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'wrong_network'
  | 'wallet_unavailable'
  | 'permission_rejected';

export interface WalletContextType {
  address: string | null;
  status: WalletStatus;
  chainId: number | null;
  client: GenLayerClientType | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  error: string | null;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus>('disconnected');
  const [chainId, setChainId] = useState<number | null>(null);
  const [client, setClient] = useState<GenLayerClientType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getProvider = (): EIP1193Provider | null => {
    if (typeof window !== 'undefined' && window.ethereum) {
      return window.ethereum;
    }
    return null;
  };

  const checkNetworkAndSwitch = useCallback(async (provider: EIP1193Provider): Promise<boolean> => {
    const targetChainIdDec = NETWORK.chainId;
    const targetChainIdHex = `0x${targetChainIdDec.toString(16)}`;

    const readChainId = async (): Promise<number> => {
      const value = await provider.request({ method: 'eth_chainId' });
      if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
        throw new Error('Wallet returned an invalid chain ID');
      }
      return parseInt(value, 16);
    };

    try {
      const currentChainId = await readChainId();
      setChainId(currentChainId);

      if (currentChainId === targetChainIdDec) {
        return true;
      }

      // Try switching
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainIdHex }],
        });
        setChainId(targetChainIdDec);
        return true;
      } catch (switchError: unknown) {
        const switchCode = errorCode(switchError);
        // If chain is not added (error code 4902), add it
        if (switchCode === 4902) {
          try {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: targetChainIdHex,
                  chainName: 'GenLayer Studionet',
                  rpcUrls: [NETWORK.rpcUrl],
                  nativeCurrency: {
                    name: 'GEN',
                    symbol: 'GEN',
                    decimals: 18,
                  },
                  blockExplorerUrls: [NETWORK.explorerUrl],
                },
              ],
            });

            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: targetChainIdHex }],
            });
          } catch (addError: unknown) {
            setError(`Failed to add network: ${errorMessage(addError)}`);
            setStatus(errorCode(addError) === 4001 ? 'permission_rejected' : 'wrong_network');
            return false;
          }
        } else {
          setError(`Failed to switch network: ${errorMessage(switchError)}`);
          setStatus(switchCode === 4001 ? 'permission_rejected' : 'wrong_network');
          return false;
        }

        const activeChainId = await readChainId();
        setChainId(activeChainId);
        if (activeChainId !== targetChainIdDec) {
          setError(`Wallet remained on chain ${activeChainId}; expected GenLayer Studionet (${targetChainIdDec}).`);
          setStatus('wrong_network');
          return false;
        }

        return true;
      }

      const activeChainId = await readChainId();
      setChainId(activeChainId);
      if (activeChainId !== targetChainIdDec) {
        setError(`Wallet remained on chain ${activeChainId}; expected GenLayer Studionet (${targetChainIdDec}).`);
        setStatus('wrong_network');
        return false;
      }

      return true;
    } catch (err: unknown) {
      setError(`Network check failed: ${errorMessage(err)}`);
      setStatus('wrong_network');
      return false;
    }
  }, []);

  const initConnection = useCallback(async (selectedAddress: string) => {
    const provider = getProvider();
    if (!provider) return;

    const netOk = await checkNetworkAndSwitch(provider);
    if (!netOk) return;

    try {
      const connectedClient = getConnectedClient(selectedAddress, provider);

      setAddress(selectedAddress);
      setClient(connectedClient);
      setStatus('connected');
      setError(null);
    } catch (err: unknown) {
      setError(`SDK Connection Error: ${errorMessage(err)}`);
      setStatus('wrong_network');
    }
  }, [checkNetworkAndSwitch]);

  const connectWallet = useCallback(async () => {
    setError(null);
    const provider = getProvider();

    if (!provider) {
      setStatus('wallet_unavailable');
      setError('MetaMask or EIP-1193 compatible wallet not detected');
      return;
    }

    setStatus('connecting');

    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        setStatus('disconnected');
        setError('No accounts returned from wallet');
        return;
      }

      await initConnection(accounts[0]);
    } catch (err: unknown) {
      console.error('Connection rejected:', err);
      setStatus('permission_rejected');
      setError(errorMessage(err) || 'Connection request rejected');
    }
  }, [initConnection]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setClient(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  // Set up listeners
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accList = accounts as string[];
      if (accList.length === 0) {
        disconnectWallet();
      } else {
        initConnection(accList[0]);
      }
    };

    const handleChainChanged = (chainIdHex: unknown) => {
      const parsedChainId = parseInt(chainIdHex as string, 16);
      setChainId(parsedChainId);
      if (parsedChainId !== NETWORK.chainId) {
        setStatus('wrong_network');
        setClient(null);
        setError('Connected to incorrect network. Please switch to GenLayer Studionet.');
      } else if (address) {
        initConnection(address);
      }
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    // Eagerly check if already connected
    provider.request({ method: 'eth_accounts' })
      .then(async (accounts) => {
        const accList = accounts as string[];
        if (accList && accList.length > 0) {
          const hexChainId = await provider.request({ method: 'eth_chainId' }) as string;
          const currentChainId = parseInt(hexChainId, 16);
          setChainId(currentChainId);
          if (currentChainId === NETWORK.chainId) {
            initConnection(accList[0]);
          } else {
            setAddress(accList[0]);
            setStatus('wrong_network');
          }
        }
      })
      .catch((err) => {
        console.error('Failed to query initial accounts:', err);
      });

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnectWallet, initConnection, address]);

  return (
    <WalletContext.Provider
      value={{
        address,
        status,
        chainId,
        client,
        connectWallet,
        disconnectWallet,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
