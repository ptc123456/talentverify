import { parseRequestJson } from './parsers';
import type { CalldataEncodable } from 'genlayer-js/types';

export interface NormalizedTransactionInfo {
  hash: string;
  status: string; // normalized
  result: string | null; // normalized
  leaderReceipt: unknown | null;
  executionResult: unknown | null;
  validators: unknown[] | null;
  isFinalized: boolean;
  isSuccess: boolean;
  errorReason: string | null;
}

const STATUS_NUMBER_TO_NAME: Record<number, string> = {
  0: "UNINITIALIZED",
  1: "PENDING",
  2: "PROPOSING",
  3: "COMMITTING",
  4: "REVEALING",
  5: "ACCEPTED",
  6: "UNDETERMINED",
  7: "FINALIZED",
  8: "CANCELED",
  9: "APPEAL_REVEALING",
  10: "APPEAL_COMMITTING",
  11: "READY_TO_FINALIZE",
  12: "VALIDATORS_TIMEOUT",
  13: "LEADER_TIMEOUT"
};

const RESULT_NUMBER_TO_NAME: Record<number, string> = {
  0: "IDLE",
  1: "AGREE",
  2: "DISAGREE",
  3: "TIMEOUT",
  4: "DETERMINISTIC_VIOLATION",
  5: "NO_MAJORITY",
  6: "MAJORITY_AGREE",
  7: "MAJORITY_DISAGREE"
};

interface RawTxProperties {
  hash?: unknown;
  status?: unknown;
  statusName?: unknown;
  status_name?: unknown;
  result?: unknown;
  resultName?: unknown;
  result_name?: unknown;
  consensusData?: unknown;
  consensus_data?: unknown;
  leaderReceipt?: unknown;
  leader_receipt?: unknown;
  txExecutionResultName?: unknown;
  tx_execution_result_name?: unknown;
  executionResult?: unknown;
  execution_result?: unknown;
}

interface RawReceiptProperties {
  mode?: unknown;
  vote?: unknown;
  execution_result?: unknown;
  executionResult?: unknown;
  status?: unknown;
  statusName?: unknown;
  error?: unknown;
  errorReason?: unknown;
  output?: unknown;
  genvm_result?: unknown;
  genvmResult?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Studionet may stop remaining validators as soon as the consensus quorum is
 * reached. Those receipts are reported as execution_result=ERROR, but they
 * are benign cancellations (vote=idle), not failed contract executions.
 */
function isBenignQuorumCancellation(receipt: RawReceiptProperties): boolean {
  if (receipt.mode !== 'validator' || receipt.vote !== 'idle') return false;

  const genvmResult = receipt.genvm_result ?? receipt.genvmResult;
  if (!isRecord(genvmResult)) return false;

  const errorCode = genvmResult.error_code;
  const stderr = genvmResult.stderr;
  return errorCode === 'CONSENSUS_VALIDATOR_QUORUM_REACHED'
    || (typeof stderr === 'string' && stderr.toLowerCase().includes('cancelled after quorum'));
}

export function normalizeTransaction(tx: unknown): NormalizedTransactionInfo {
  if (!tx || !isRecord(tx)) {
    throw new Error("Transaction data is null, undefined, or not an object");
  }

  const raw = tx as RawTxProperties;
  const hash = typeof raw.hash === "string" ? raw.hash : "";

  // 1. Status normalization (name properties take priority over numeric)
  const rawStatus = raw.statusName || raw.status_name || raw.status;
  let status = "";
  if (typeof rawStatus === "string") {
    const num = parseInt(rawStatus, 10);
    if (!isNaN(num) && num in STATUS_NUMBER_TO_NAME) {
      status = STATUS_NUMBER_TO_NAME[num];
    } else {
      status = rawStatus.toUpperCase();
    }
  } else if (typeof rawStatus === "number" && rawStatus in STATUS_NUMBER_TO_NAME) {
    status = STATUS_NUMBER_TO_NAME[rawStatus];
  } else if (rawStatus !== null && rawStatus !== undefined) {
    status = String(rawStatus).toUpperCase();
  }

  // 2. Result normalization (name properties take priority over numeric)
  const rawResult = raw.resultName || raw.result_name || raw.result;
  let result: string | null = null;
  if (typeof rawResult === "string") {
    const num = parseInt(rawResult, 10);
    if (!isNaN(num) && num in RESULT_NUMBER_TO_NAME) {
      result = RESULT_NUMBER_TO_NAME[num];
    } else {
      result = rawResult.toUpperCase();
    }
  } else if (typeof rawResult === "number" && rawResult in RESULT_NUMBER_TO_NAME) {
    result = RESULT_NUMBER_TO_NAME[rawResult];
  } else if (rawResult !== null && rawResult !== undefined) {
    result = String(rawResult).toUpperCase();
  }

  // 3. Consensus Data normalization
  const consensusData = raw.consensusData || raw.consensus_data;
  const hasConsensus = isRecord(consensusData);

  // 4. Leader Receipt normalization
  let leaderReceipt: unknown = null;
  let validators: unknown[] | null = null;
  if (hasConsensus) {
    const cd = consensusData as Record<string, unknown>;
    leaderReceipt = cd.leaderReceipt || cd.leader_receipt || null;
    if (Array.isArray(cd.validators)) {
      validators = cd.validators;
    }
  }
  if (!leaderReceipt) {
    leaderReceipt = raw.leaderReceipt || raw.leader_receipt || null;
  }

  // 5. Execution Result normalization
  let executionResult: unknown = null;
  if (isRecord(leaderReceipt)) {
    const lr = leaderReceipt as RawReceiptProperties;
    executionResult = lr.executionResult || lr.execution_result || null;
  }
  if (!executionResult) {
    executionResult = raw.txExecutionResultName || raw.tx_execution_result_name || raw.executionResult || raw.execution_result || null;
  }

  // Success checklist:
  const isFinalized = status === "FINALIZED";
  let isSuccess = false;
  let errorReason: string | null = null;

  if (isFinalized) {
    if (result !== "MAJORITY_AGREE") {
      errorReason = `Consensus did not agree (result: ${result})`;
    } else {
      // Success gate
      // Collect receipts from leader receipt and validators
      const receipts: unknown[] = [];
      if (leaderReceipt) {
        if (Array.isArray(leaderReceipt)) {
          receipts.push(...leaderReceipt);
        } else {
          receipts.push(leaderReceipt);
        }
      }
      if (validators && Array.isArray(validators)) {
        receipts.push(...validators);
      }

      let hasSuccessProof = false;
      let hasExecutionFailure = false;
      const failures: string[] = [];

      for (const r of receipts) {
        if (!r || !isRecord(r)) continue;
        const rec = r as RawReceiptProperties;

        if (isBenignQuorumCancellation(rec)) {
          continue;
        }
        
        // Extract status
        let execStatus = "";
        const rawExec = rec.execution_result || rec.executionResult || rec.status || rec.statusName || "";
        if (typeof rawExec === "string") {
          execStatus = rawExec.toUpperCase();
        } else if (typeof rawExec === "number") {
          execStatus = String(rawExec).toUpperCase();
        }

        // Extract error
        let err: string | null = null;
        if (typeof rec.error === "string" && rec.error) {
          err = rec.error;
        } else if (typeof rec.errorReason === "string" && rec.errorReason) {
          err = rec.errorReason;
        }

        if (execStatus === "SUCCESS" && !err) {
          hasSuccessProof = true;
        } else if (
          execStatus === "ERROR" || 
          execStatus === "FAILED" || 
          execStatus === "FAILURE" || 
          err
        ) {
          hasExecutionFailure = true;
          failures.push(err || execStatus || "Execution error");
        }
      }

      if (receipts.length === 0) {
        // Fallback checks on single variables in root if receipts empty
        let rootExecStatus = "";
        if (typeof executionResult === "string") {
          rootExecStatus = executionResult.toUpperCase();
        } else if (isRecord(executionResult)) {
          const er = executionResult as Record<string, unknown>;
          rootExecStatus = String(er.status || "").toUpperCase();
        }
        
        if (rootExecStatus === "SUCCESS") {
          isSuccess = true;
        } else {
          errorReason = "No execution receipts found";
        }
      } else if (hasExecutionFailure) {
        errorReason = `Execution failed: ${failures.join("; ")}`;
      } else if (!hasSuccessProof) {
        errorReason = "No receipt showing execution SUCCESS";
      } else {
        isSuccess = true;
      }
    }
  }

  return {
    hash,
    status,
    result,
    leaderReceipt,
    executionResult,
    validators,
    isFinalized,
    isSuccess,
    errorReason,
  };
}

export function tryDecodeIdFromReceipt(receipt: unknown): number | null {
  if (!receipt) return null;
  
  // Inspect single receipt or first array element
  let target: unknown = receipt;
  if (Array.isArray(receipt)) {
    if (receipt.length === 0) return null;
    target = receipt[0];
  }

  if (!isRecord(target)) return null;

  const rec = target as RawReceiptProperties;
  const output = rec.output || rec.execution_result || rec.executionResult;
  if (output && isRecord(output)) {
    const out = output as Record<string, unknown>;
    const val = out.request_id || out.returnValue || out.return_value;
    if (typeof val === 'number' && val > 0) {
      return val;
    }
    if (typeof val === 'string') {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  if (typeof output === 'number' && output > 0) {
    return output;
  }
  if (typeof output === 'string') {
    const match = output.match(/request_id["\s:]+(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    const num = parseInt(output, 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

export interface GenLayerReadContractInterface {
  readContract(opts: { address: `0x${string}`; functionName: string; args: CalldataEncodable[] }): Promise<unknown>;
}

export interface RangeResolutionParams {
  contractAddress: string;
  preSubmitCount: number;
  postSubmitCount: number;
  ownerAddress: string;
  readClient: GenLayerReadContractInterface;
}

export async function resolveRequestIdFromRange(params: RangeResolutionParams): Promise<number | null> {
  const { contractAddress, preSubmitCount, postSubmitCount, ownerAddress, readClient } = params;
  
  if (postSubmitCount <= preSubmitCount) {
    return null;
  }
  
  let matchedId: number | null = null;
  let matchCount = 0;
  
  for (let i = preSubmitCount + 1; i <= postSubmitCount; i++) {
    try {
      const responseStr = await readClient.readContract({
        address: contractAddress as `0x${string}`,
        functionName: 'get_request',
        args: [i]
      });
      if (typeof responseStr === 'string') {
        const req = parseRequestJson(responseStr);
        if (req && req.owner.toLowerCase() === ownerAddress.toLowerCase()) {
          matchedId = i;
          matchCount++;
        }
      }
    } catch (err) {
      console.warn(`Error reading request ${i}:`, err);
    }
  }
  
  if (matchCount === 1) {
    return matchedId;
  }
  return null;
}

export interface GenLayerGetTransactionInterface {
  getTransaction(opts: { hash: string }): Promise<unknown>;
}

export interface MonitorOptions {
  hash: string;
  client: GenLayerGetTransactionInterface;
  onStateChange?: (normalized: NormalizedTransactionInfo) => void;
  intervalMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
}

// Error type guard
function isResourceNotFoundRpcError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.name === 'string' && err.name === 'ResourceNotFoundRpcError') {
      return true;
    }
    if (typeof err.message === 'string') {
      const msg = err.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('resource not found')) {
        return true;
      }
    }
  }
  return false;
}

export function isAbortError(error: unknown): boolean {
  if (getErrorMessage(error) === "Transaction monitoring aborted") return true;
  return isRecord(error) && error.name === "AbortError";
}

export async function monitorTransaction(options: MonitorOptions): Promise<NormalizedTransactionInfo> {
  const { hash, client, onStateChange, intervalMs = 3000, maxAttempts = 100, signal } = options;
  let attempt = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const finishResolve = (value: NormalizedTransactionInfo) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onAbort = () => {
      finishReject(new Error("Transaction monitoring aborted"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort);
    }

    const check = async () => {
      try {
        if (settled || signal?.aborted) return;
        attempt++;
        
        let tx: unknown = null;
        try {
          tx = await client.getTransaction({ hash });
        } catch (err: unknown) {
          if (settled || signal?.aborted) return;
          
          if (isResourceNotFoundRpcError(err)) {
            if (attempt >= maxAttempts) {
              finishReject(new Error(`Transaction monitoring timed out: transaction ${hash} not found after maximum attempts`));
              return;
            }
            timerId = setTimeout(check, intervalMs);
            return;
          } else {
            finishReject(err instanceof Error ? err : new Error(String(err)));
            return;
          }
        }

        // Abort may happen while getTransaction is awaiting the RPC response.
        // Never publish state or schedule another poll after the monitor settles.
        if (settled || signal?.aborted) return;

        if (!tx) {
          if (attempt >= maxAttempts) {
            finishReject(new Error("Transaction monitoring timed out: reached maximum attempts"));
            return;
          }
          timerId = setTimeout(check, intervalMs);
          return;
        }

        const normalized = normalizeTransaction(tx);
        if (onStateChange) {
          onStateChange(normalized);
        }

        if (normalized.isFinalized) {
          finishResolve(normalized);
          return;
        }

        if (normalized.status === "CANCELED" || normalized.status === "UNDETERMINED") {
          finishReject(new Error(`Transaction terminated with status ${normalized.status}`));
          return;
        }

        if (
          normalized.status === "LEADER_TIMEOUT" ||
          normalized.status === "VALIDATORS_TIMEOUT"
        ) {
          finishReject(new Error(`Transaction timed out: ${normalized.status}`));
          return;
        }

        if (attempt >= maxAttempts) {
          finishReject(new Error("Transaction monitoring timed out: reached maximum attempts"));
          return;
        }

        if (!settled && !signal?.aborted) {
          timerId = setTimeout(check, intervalMs);
        }
      } catch (err: unknown) {
        finishReject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    timerId = setTimeout(check, 0);
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}
