export interface PendingVerificationContext {
  hash: string;
  preSubmitCount: number;
  ownerAddress: string;
  contractAddress: string;
  chainId: number;
  timestamp: number;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function parsePendingVerificationContext(val: unknown): PendingVerificationContext {
  if (!isRecord(val)) {
    throw new Error("Context is not a valid object");
  }

  const { hash, preSubmitCount, ownerAddress, contractAddress, chainId, timestamp } = val;

  if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error("Invalid transaction hash format");
  }

  if (typeof preSubmitCount !== 'number' || !Number.isSafeInteger(preSubmitCount) || preSubmitCount < 0) {
    throw new Error("Invalid preSubmitCount");
  }

  if (typeof ownerAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(ownerAddress)) {
    throw new Error("Invalid ownerAddress format");
  }

  if (typeof contractAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    throw new Error("Invalid contractAddress format");
  }

  if (typeof chainId !== 'number' || chainId !== 61999) {
    throw new Error("Invalid chainId");
  }

  if (typeof timestamp !== 'number' || !Number.isInteger(timestamp) || timestamp <= 0 || !Number.isFinite(timestamp)) {
    throw new Error("Invalid timestamp");
  }

  return {
    hash,
    preSubmitCount,
    ownerAddress,
    contractAddress,
    chainId,
    timestamp
  };
}

export function safeParsePendingVerificationContext(val: unknown): PendingVerificationContext | null {
  try {
    return parsePendingVerificationContext(val);
  } catch (_) {
    return null;
  }
}
