import { describe, test, expect, vi } from 'vitest';
import { 
  normalizeTransaction, 
  tryDecodeIdFromReceipt, 
  monitorTransaction,
  resolveRequestIdFromRange 
} from '../lib/transactions';

describe('Transaction Normalization & Success Gate', () => {
  // A. SDK transaction shape thật đã sanitize
  test('A. normalizes real SDK transaction shape successfully', () => {
    const tx = {
      status: 7,
      statusName: "FINALIZED",
      result: 6,
      consensus_data: {
        leader_receipt: [
          { mode: "leader", execution_result: "SUCCESS" },
          { mode: "validator", execution_result: "SUCCESS" }
        ],
        validators: [
          { mode: "validator", execution_result: "SUCCESS" }
        ]
      }
    };
    const norm = normalizeTransaction(tx);
    expect(norm.status).toBe('FINALIZED');
    expect(norm.result).toBe('MAJORITY_AGREE');
    expect(norm.isFinalized).toBe(true);
    expect(norm.isSuccess).toBe(true);
    expect(norm.errorReason).toBeNull();
  });

  // B. Test statusName không bị numeric status che mất
  test('B. statusName and resultName take priority over numeric status and result', () => {
    const tx = {
      status: 1, // PENDING
      statusName: "FINALIZED",
      result: 0, // IDLE
      resultName: "MAJORITY_AGREE"
    };
    const norm = normalizeTransaction(tx);
    expect(norm.status).toBe('FINALIZED');
    expect(norm.result).toBe('MAJORITY_AGREE');
  });

  // C. Test numeric-only status/result mapping
  test('C. normalizes numeric-only status and result correctly', () => {
    const tx1 = {
      status: 7,
      result: 6
    };
    const norm1 = normalizeTransaction(tx1);
    expect(norm1.status).toBe('FINALIZED');
    expect(norm1.result).toBe('MAJORITY_AGREE');

    const tx2 = {
      status: 5, // ACCEPTED
      result: 7 // MAJORITY_DISAGREE
    };
    const norm2 = normalizeTransaction(tx2);
    expect(norm2.status).toBe('ACCEPTED');
    expect(norm2.result).toBe('MAJORITY_DISAGREE');
  });

  // D. leader_receipt dạng array
  test('D. supports leader_receipt as an array and validator receipts', () => {
    const tx = {
      statusName: "FINALIZED",
      resultName: "MAJORITY_AGREE",
      consensus_data: {
        leader_receipt: [
          { mode: "leader", execution_result: "SUCCESS" }
        ]
      }
    };
    const norm = normalizeTransaction(tx);
    expect(norm.isSuccess).toBe(true);
  });

  // E. Một receipt ERROR phải khiến isSuccess=false
  test('E. fails success gate if any validator or leader receipt shows failure/error', () => {
    const tx = {
      statusName: "FINALIZED",
      resultName: "MAJORITY_AGREE",
      consensus_data: {
        leader_receipt: [
          { mode: "leader", execution_result: "SUCCESS" },
          { mode: "leader", execution_result: "ERROR" } // Failure
        ]
      }
    };
    const norm = normalizeTransaction(tx);
    expect(norm.isSuccess).toBe(false);
    expect(norm.errorReason).toContain('Execution failed');
  });

  test('E2. fails success gate if validator has non-empty error field', () => {
    const tx = {
      statusName: "FINALIZED",
      resultName: "MAJORITY_AGREE",
      consensus_data: {
        leader_receipt: [
          { mode: "leader", execution_result: "SUCCESS" }
        ],
        validators: [
          { mode: "validator", execution_result: "SUCCESS", error: "Something crashed" }
        ]
      }
    };
    const norm = normalizeTransaction(tx);
    expect(norm.isSuccess).toBe(false);
    expect(norm.errorReason).toContain('Something crashed');
  });

  // F. Không có execution proof phải khiến isSuccess=false
  test('E3. ignores validators cancelled after quorum is reached', () => {
    const tx = {
      status: 7,
      result: 6,
      consensus_data: {
        leader_receipt: [
          { mode: 'leader', execution_result: 'SUCCESS' },
          {
            mode: 'validator',
            vote: 'idle',
            execution_result: 'ERROR',
            genvm_result: {
              error_code: 'CONSENSUS_VALIDATOR_QUORUM_REACHED',
              stderr: 'Validator execution cancelled after quorum'
            }
          }
        ],
        validators: [
          { mode: 'validator', vote: 'agree', execution_result: 'SUCCESS' },
          {
            mode: 'validator',
            vote: 'idle',
            execution_result: 'ERROR',
            genvm_result: {
              error_code: 'CONSENSUS_VALIDATOR_QUORUM_REACHED',
              stderr: 'Validator execution cancelled after quorum'
            }
          }
        ]
      }
    };

    const norm = normalizeTransaction(tx);
    expect(norm.isSuccess).toBe(true);
    expect(norm.errorReason).toBeNull();
  });

  test('F. fails success gate if no execution proof is present', () => {
    const tx = {
      statusName: "FINALIZED",
      resultName: "MAJORITY_AGREE",
      consensus_data: {
        leader_receipt: []
      }
    };
    const norm = normalizeTransaction(tx);
    expect(norm.isSuccess).toBe(false);
    expect(norm.errorReason).toContain('No execution receipts found');
  });

  // G. ACCEPTED không phải success
  test('G. does not declare success on ACCEPTED status', () => {
    const tx = {
      statusName: "ACCEPTED",
      resultName: "MAJORITY_AGREE",
      consensus_data: {
        leader_receipt: [{ execution_result: "SUCCESS" }]
      }
    };
    const norm = normalizeTransaction(tx);
    expect(norm.isFinalized).toBe(false);
    expect(norm.isSuccess).toBe(false);
  });

  // H. MAJORITY_DISAGREE không phải success
  test('H. does not declare success on MAJORITY_DISAGREE', () => {
    const tx = {
      statusName: "FINALIZED",
      resultName: "MAJORITY_DISAGREE",
      consensus_data: {
        leader_receipt: [{ execution_result: "SUCCESS" }]
      }
    };
    const norm = normalizeTransaction(tx);
    expect(norm.isSuccess).toBe(false);
    expect(norm.errorReason).toContain('Consensus did not agree');
  });

  // I. CANCELED, UNDETERMINED và timeout states
  test('I. handles CANCELED, UNDETERMINED and timeout states correctly', () => {
    expect(normalizeTransaction({ statusName: 'CANCELED' }).status).toBe('CANCELED');
    expect(normalizeTransaction({ statusName: 'UNDETERMINED' }).status).toBe('UNDETERMINED');
    expect(normalizeTransaction({ statusName: 'LEADER_TIMEOUT' }).status).toBe('LEADER_TIMEOUT');
    expect(normalizeTransaction({ statusName: 'VALIDATORS_TIMEOUT' }).status).toBe('VALIDATORS_TIMEOUT');
  });
});

describe('tryDecodeIdFromReceipt Helper', () => {
  test('decodes numeric request_id from leader_receipt', () => {
    const receipt = {
      output: {
        request_id: 42
      }
    };
    expect(tryDecodeIdFromReceipt(receipt)).toBe(42);
  });

  test('decodes request_id from leader_receipt array', () => {
    const receipt = [
      {
        output: {
          request_id: 15
        }
      }
    ];
    expect(tryDecodeIdFromReceipt(receipt)).toBe(15);
  });

  test('returns null on invalid structures', () => {
    expect(tryDecodeIdFromReceipt(null)).toBeNull();
    expect(tryDecodeIdFromReceipt([])).toBeNull();
  });
});

// J. Request-ID range resolution tests
describe('J. Request-ID Range Resolution Helper', () => {
  const contractAddress = '0xf828Bad28f46F2FFd59C25AE3BB12148Be5c0B14';
  const ownerAddress = '0x1111111111111111111111111111111111111111';

  test('only scans IDs inside the specified range [preCount + 1, postCount]', async () => {
    const readContractMock = vi.fn().mockImplementation((opts) => {
      const id = opts.args[0];
      return JSON.stringify({
        request_id: id,
        owner: ownerAddress,
        skill: 'React',
        github_username: 'octocat',
        repo_url_1: 'https://github.com/octocat/repo1',
        repo_url_2: '',
        repo_url_3: '',
        status: 'SUBMITTED',
        verdict: '',
        reason: '',
        evidence_summary: '',
        created_at: 1000,
        evaluated_at: 0
      });
    });

    const readClient = { readContract: readContractMock };

    // Range [5 + 1, 7] => 6 and 7
    const result = await resolveRequestIdFromRange({
      contractAddress,
      preSubmitCount: 5,
      postSubmitCount: 7,
      ownerAddress,
      readClient
    });

    expect(readContractMock).toHaveBeenCalledTimes(2);
    expect(readContractMock.mock.calls[0][0].args[0]).toBe(6);
    expect(readContractMock.mock.calls[1][0].args[0]).toBe(7);
    // Since both matched, it's ambiguous, so it should return null
    expect(result).toBeNull();
  });

  test('filters out owner mismatch entries', async () => {
    const readContractMock = vi.fn().mockImplementation((opts) => {
      const id = opts.args[0];
      const owner = id === 6 ? '0xwrong' : ownerAddress;
      return JSON.stringify({
        request_id: id,
        owner,
        skill: 'React',
        github_username: 'octocat',
        repo_url_1: 'https://github.com/octocat/repo1',
        repo_url_2: '',
        repo_url_3: '',
        status: 'SUBMITTED',
        verdict: '',
        reason: '',
        evidence_summary: '',
        created_at: 1000,
        evaluated_at: 0
      });
    });

    const readClient = { readContract: readContractMock };

    // Range [5 + 1, 7] => 6 (wrong owner) and 7 (correct owner)
    const result = await resolveRequestIdFromRange({
      contractAddress,
      preSubmitCount: 5,
      postSubmitCount: 7,
      ownerAddress,
      readClient
    });

    expect(result).toBe(7); // Single unique match found
  });

  test('handles malformed JSON response safely without crashing', async () => {
    const readContractMock = vi.fn().mockImplementation((opts) => {
      const id = opts.args[0];
      if (id === 6) return 'invalid-json';
      return JSON.stringify({
        request_id: id,
        owner: ownerAddress,
        skill: 'React',
        github_username: 'octocat',
        repo_url_1: 'https://github.com/octocat/repo1',
        repo_url_2: '',
        repo_url_3: '',
        status: 'SUBMITTED',
        verdict: '',
        reason: '',
        evidence_summary: '',
        created_at: 1000,
        evaluated_at: 0
      });
    });

    const readClient = { readContract: readContractMock };

    // 6 fails to parse, 7 parses successfully and matches
    const result = await resolveRequestIdFromRange({
      contractAddress,
      preSubmitCount: 5,
      postSubmitCount: 7,
      ownerAddress,
      readClient
    });

    expect(result).toBe(7); // Successfully skips id 6 and resolves to 7
  });

  test('returns null if there are zero matches or multiple matches', async () => {
    const readContractMock = vi.fn().mockResolvedValue(JSON.stringify({
      request_id: 1,
      owner: '0xwrong',
      skill: 'React',
      github_username: 'octocat',
      repo_url_1: '', repo_url_2: '', repo_url_3: '',
      status: 'SUBMITTED', verdict: '', reason: '', evidence_summary: '',
      created_at: 0, evaluated_at: 0
    }));

    const readClient = { readContract: readContractMock };

    const result = await resolveRequestIdFromRange({
      contractAddress,
      preSubmitCount: 5,
      postSubmitCount: 7,
      ownerAddress,
      readClient
    });

    expect(result).toBeNull(); // Zero matches
  });
});

class ResourceNotFoundRpcError extends Error {
  name = 'ResourceNotFoundRpcError';
  constructor(message = 'Requested resource not found.') {
    super(message);
  }
}

describe('monitorTransaction Polling and Blocker 1 Retries', () => {
  test('resolves successfully if ResourceNotFoundRpcError is thrown at first but succeeded later', async () => {
    let callCount = 0;
    const client = {
      getTransaction: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new ResourceNotFoundRpcError();
        }
        if (callCount === 2) {
          return { statusName: 'PENDING' };
        }
        return {
          statusName: 'FINALIZED',
          resultName: 'MAJORITY_AGREE',
          consensus_data: {
            leader_receipt: [{ execution_result: 'SUCCESS' }]
          }
        };
      })
    };

    const final = await monitorTransaction({
      hash: '0x123',
      client,
      intervalMs: 1,
      maxAttempts: 5
    });

    expect(final.isSuccess).toBe(true);
    expect(client.getTransaction).toHaveBeenCalledTimes(3);
  });

  test('rejects immediately on non-retryable error', async () => {
    const client = {
      getTransaction: vi.fn().mockRejectedValue(new Error('Fatal RPC failure'))
    };

    await expect(monitorTransaction({
      hash: '0x123',
      client,
      intervalMs: 1,
      maxAttempts: 5
    })).rejects.toThrow('Fatal RPC failure');

    expect(client.getTransaction).toHaveBeenCalledTimes(1);
  });

  test('timeouts after maxAttempts if not-found error persists', async () => {
    const client = {
      getTransaction: vi.fn().mockRejectedValue(new ResourceNotFoundRpcError())
    };

    await expect(monitorTransaction({
      hash: '0x123',
      client,
      intervalMs: 1,
      maxAttempts: 3
    })).rejects.toThrow('not found after maximum attempts');

    expect(client.getTransaction).toHaveBeenCalledTimes(3);
  });

  test('aborts immediately when AbortSignal is triggered during retry', async () => {
    const client = {
      getTransaction: vi.fn().mockRejectedValue(new ResourceNotFoundRpcError())
    };

    const controller = new AbortController();
    
    // Trigger abort right after first attempt
    const monitorPromise = monitorTransaction({
      hash: '0x123',
      client,
      intervalMs: 50,
      maxAttempts: 5,
      signal: controller.signal
    });

    setTimeout(() => {
      controller.abort();
    }, 15);

    await expect(monitorPromise).rejects.toThrow('Transaction monitoring aborted');
  });

  test('does not publish state or schedule another poll when aborted during an in-flight RPC call', async () => {
    let resolveInFlight!: (value: unknown) => void;
    const inFlight = new Promise<unknown>((resolve) => {
      resolveInFlight = resolve;
    });
    const client = {
      getTransaction: vi.fn().mockReturnValue(inFlight)
    };
    const controller = new AbortController();
    const onStateChange = vi.fn();

    const monitorPromise = monitorTransaction({
      hash: '0x123',
      client,
      intervalMs: 1,
      maxAttempts: 5,
      signal: controller.signal,
      onStateChange
    });

    await vi.waitFor(() => expect(client.getTransaction).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(monitorPromise).rejects.toThrow('Transaction monitoring aborted');

    resolveInFlight({ statusName: 'PENDING' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(client.getTransaction).toHaveBeenCalledTimes(1);
    expect(onStateChange).not.toHaveBeenCalled();
  });
});
