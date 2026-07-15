import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getConnectedClient, GenLayerClientType } from '../lib/genlayer';
import { NETWORK } from '../config/network';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

    try {
      const currentChainIdHex = await provider.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(currentChainIdHex as string, 16);
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
        const switchCode = typeof switchError === 'object' && switchError !== null &&
          'code' in switchError && typeof switchError.code === 'number'
          ? switchError.code
          : undefined;
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
            setChainId(targetChainIdDec);
            return true;
          } catch (addError: unknown) {
            setError(`Failed to add network: ${errorMessage(addError)}`);
            setStatus('wrong_network');
            return false;
          }
        }
        setError(`Failed to switch network: ${errorMessage(switchError)}`);
        setStatus('wrong_network');
        return false;
      }
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
      const connectedClient = getConnectedClient(selectedAddress);
      // Verify chain switching succeeds inside SDK
      await connectedClient.connect('studionet');

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
