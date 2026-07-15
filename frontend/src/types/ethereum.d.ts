interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  removeListener(event: string, callback: (...args: unknown[]) => void): void;
}

interface Window {
  ethereum?: EIP1193Provider & {
    isMetaMask?: boolean;
  };
}
