export type Verdict = 'SUPPORTED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_SUPPORTED' | 'INCONCLUSIVE';

export type RequestStatus = 'SUBMITTED' | 'FINALIZED';

export interface VerificationRequest {
  request_id: number;
  owner: string;
  skill: string;
  github_username: string;
  repo_url_1: string;
  repo_url_2: string;
  repo_url_3: string;
  status: RequestStatus;
  verdict: Verdict | '';
  reason: string;
  evidence_summary: string;
  created_at: number;
  evaluated_at: number;
}

export interface Attestation {
  request_id: number;
  owner: string;
  skill: string;
  github_username: string;
  repo_url_1: string;
  repo_url_2: string;
  repo_url_3: string;
  status: 'FINALIZED';
  verdict: Verdict;
  reason: string;
  evidence_summary: string;
  created_at: number;
  evaluated_at: number;
}
