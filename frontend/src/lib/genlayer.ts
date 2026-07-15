import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const contractAddress = import.meta.env.VITE_GENLAYER_CONTRACT_ADDRESS;

export function getContractAddress(): string {
  if (!contractAddress) {
    throw new Error("Configuration Error: VITE_GENLAYER_CONTRACT_ADDRESS is not defined");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    throw new Error(`Configuration Error: VITE_GENLAYER_CONTRACT_ADDRESS "${contractAddress}" is not a valid 20-byte hex address`);
  }
  return contractAddress;
}

// Read-only client for public views
export const readClient = createClient({
  chain: studionet,
});

// Helper to create a dynamic client with wallet address for writes
export function getConnectedClient(walletAddress: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }
  return createClient({
    chain: studionet,
    account: walletAddress as `0x${string}`,
  });
}

export type GenLayerClientType = ReturnType<typeof getConnectedClient>;
export type GenLayerReadClientType = typeof readClient;
