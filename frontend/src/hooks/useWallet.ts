import { useContext } from 'react';
import { WalletContext, WalletContextType } from '../context/WalletContext';

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
