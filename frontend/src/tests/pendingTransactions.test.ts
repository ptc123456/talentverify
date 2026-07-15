import { describe, test, expect } from 'vitest';
import { 
  parsePendingVerificationContext, 
  safeParsePendingVerificationContext 
} from '../lib/pendingTransactions';

describe('Pending Transaction Context Validation', () => {
  const validObj = {
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    preSubmitCount: 5,
    ownerAddress: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
    contractAddress: '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14',
    chainId: 61999,
    timestamp: 1715000000000
  };

  test('valid context parses successfully and retains preSubmitCount', () => {
    const parsed = parsePendingVerificationContext(validObj);
    expect(parsed.hash).toBe(validObj.hash);
    expect(parsed.preSubmitCount).toBe(5);
    expect(parsed.ownerAddress).toBe(validObj.ownerAddress);
    expect(parsed.chainId).toBe(61999);
  });

  test('null/array/non-object throws error', () => {
    expect(() => parsePendingVerificationContext(null)).toThrow();
    expect(() => parsePendingVerificationContext([])).toThrow();
    expect(() => parsePendingVerificationContext("string")).toThrow();
  });

  test('missing fields throw error', () => {
    const { hash, ...missingHash } = validObj;
    expect(() => parsePendingVerificationContext(missingHash)).toThrow();

    const { preSubmitCount, ...missingCount } = validObj;
    expect(() => parsePendingVerificationContext(missingCount)).toThrow();
  });

  test('invalid transaction hash format throws error', () => {
    const invalidHash1 = { ...validObj, hash: '0x123' }; // Too short
    expect(() => parsePendingVerificationContext(invalidHash1)).toThrow();

    const invalidHash2 = { ...validObj, hash: 123 }; // Wrong type
    expect(() => parsePendingVerificationContext(invalidHash2)).toThrow();
  });

  test('negative/fractional preSubmitCount throws error', () => {
    const negCount = { ...validObj, preSubmitCount: -1 };
    expect(() => parsePendingVerificationContext(negCount)).toThrow();

    const fracCount = { ...validObj, preSubmitCount: 5.5 };
    expect(() => parsePendingVerificationContext(fracCount)).toThrow();
  });

  test('invalid ownerAddress format throws error', () => {
    const invalidOwner = { ...validObj, ownerAddress: '0x123' };
    expect(() => parsePendingVerificationContext(invalidOwner)).toThrow();
  });

  test('invalid contractAddress format throws error', () => {
    const invalidContract = { ...validObj, contractAddress: 'invalid' };
    expect(() => parsePendingVerificationContext(invalidContract)).toThrow();
  });

  test('wrong chain ID throws error', () => {
    const wrongChain = { ...validObj, chainId: 1 };
    expect(() => parsePendingVerificationContext(wrongChain)).toThrow();
  });

  test('invalid timestamp throws error', () => {
    const negTimestamp = { ...validObj, timestamp: -100 };
    expect(() => parsePendingVerificationContext(negTimestamp)).toThrow();

    const floatTimestamp = { ...validObj, timestamp: 123.45 };
    expect(() => parsePendingVerificationContext(floatTimestamp)).toThrow();

    const infiniteTimestamp = { ...validObj, timestamp: Infinity };
    expect(() => parsePendingVerificationContext(infiniteTimestamp)).toThrow();
  });

  test('safeParsePendingVerificationContext returns null on error', () => {
    expect(safeParsePendingVerificationContext(null)).toBeNull();
    expect(safeParsePendingVerificationContext({ ...validObj, chainId: 1 })).toBeNull();
    expect(safeParsePendingVerificationContext(validObj)).toEqual(validObj);
  });
});
