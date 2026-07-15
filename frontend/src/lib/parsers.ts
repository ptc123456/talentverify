import { VerificationRequest, Attestation } from '../types/domain';

export function parseRequestJson(jsonStr: string): VerificationRequest {
  if (!jsonStr) {
    throw new Error('Empty request JSON response');
  }
  const parsed = JSON.parse(jsonStr);
  
  if (typeof parsed.request_id !== 'number') throw new Error('request_id must be a number');
  if (typeof parsed.owner !== 'string') throw new Error('owner must be a string');
  if (typeof parsed.skill !== 'string') throw new Error('skill must be a string');
  if (typeof parsed.github_username !== 'string') throw new Error('github_username must be a string');
  if (typeof parsed.repo_url_1 !== 'string') throw new Error('repo_url_1 must be a string');
  if (typeof parsed.repo_url_2 !== 'string') throw new Error('repo_url_2 must be a string');
  if (typeof parsed.repo_url_3 !== 'string') throw new Error('repo_url_3 must be a string');
  if (parsed.status !== 'SUBMITTED' && parsed.status !== 'FINALIZED') throw new Error('status must be SUBMITTED or FINALIZED');
  
  const allowedVerdicts = ['SUPPORTED', 'INSUFFICIENT_EVIDENCE', 'NOT_SUPPORTED', 'INCONCLUSIVE', ''];
  if (!allowedVerdicts.includes(parsed.verdict)) throw new Error(`Invalid verdict: ${parsed.verdict}`);
  
  if (typeof parsed.reason !== 'string') throw new Error('reason must be a string');
  if (typeof parsed.evidence_summary !== 'string') throw new Error('evidence_summary must be a string');
  if (typeof parsed.created_at !== 'number') throw new Error('created_at must be a number');
  if (typeof parsed.evaluated_at !== 'number') throw new Error('evaluated_at must be a number');
  
  return parsed as VerificationRequest;
}

export function parseAttestationsJson(jsonStr: string): Attestation[] {
  if (!jsonStr) {
    throw new Error('Empty attestations JSON response');
  }
  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) {
    throw new Error('Attestations response must be an array');
  }
  
  const allowedVerdicts = ['SUPPORTED', 'INSUFFICIENT_EVIDENCE', 'NOT_SUPPORTED', 'INCONCLUSIVE'];
  
  return parsed.map((item, idx) => {
    if (typeof item.request_id !== 'number') throw new Error(`[index ${idx}] request_id must be a number`);
    if (typeof item.owner !== 'string') throw new Error(`[index ${idx}] owner must be a string`);
    if (typeof item.skill !== 'string') throw new Error(`[index ${idx}] skill must be a string`);
    if (typeof item.github_username !== 'string') throw new Error(`[index ${idx}] github_username must be a string`);
    if (typeof item.repo_url_1 !== 'string') throw new Error(`[index ${idx}] repo_url_1 must be a string`);
    if (typeof item.repo_url_2 !== 'string') throw new Error(`[index ${idx}] repo_url_2 must be a string`);
    if (typeof item.repo_url_3 !== 'string') throw new Error(`[index ${idx}] repo_url_3 must be a string`);
    if (item.status !== 'FINALIZED') throw new Error(`[index ${idx}] status must be FINALIZED`);
    if (!allowedVerdicts.includes(item.verdict)) throw new Error(`[index ${idx}] Invalid verdict: ${item.verdict}`);
    if (typeof item.reason !== 'string') throw new Error(`[index ${idx}] reason must be a string`);
    if (typeof item.evidence_summary !== 'string') throw new Error(`[index ${idx}] evidence_summary must be a string`);
    if (typeof item.created_at !== 'number') throw new Error(`[index ${idx}] created_at must be a number`);
    if (typeof item.evaluated_at !== 'number') throw new Error(`[index ${idx}] evaluated_at must be a number`);
    
    return item as Attestation;
  });
}
