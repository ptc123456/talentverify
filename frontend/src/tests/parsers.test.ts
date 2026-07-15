import { describe, test, expect } from 'vitest';
import { parseRequestJson, parseAttestationsJson } from '../lib/parsers';

describe('JSON Request Parser', () => {
  test('parses valid JSON response', () => {
    const validJson = JSON.stringify({
      request_id: 1,
      owner: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      skill: 'React',
      github_username: 'octocat',
      repo_url_1: 'https://github.com/octocat/repo1',
      repo_url_2: '',
      repo_url_3: '',
      status: 'SUBMITTED',
      verdict: '',
      reason: '',
      evidence_summary: '',
      created_at: 1718223932,
      evaluated_at: 0
    });
    const parsed = parseRequestJson(validJson);
    expect(parsed.request_id).toBe(1);
    expect(parsed.skill).toBe('React');
    expect(parsed.status).toBe('SUBMITTED');
  });

  test('throws on missing required keys', () => {
    const malformed = JSON.stringify({
      request_id: 1,
      owner: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      skill: 'React'
    });
    expect(() => parseRequestJson(malformed)).toThrow();
  });

  test('throws on invalid data types', () => {
    const invalidTypes = JSON.stringify({
      request_id: 'not-a-number',
      owner: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      skill: 'React',
      github_username: 'octocat',
      repo_url_1: 'https://github.com/octocat/repo1',
      repo_url_2: '',
      repo_url_3: '',
      status: 'SUBMITTED',
      verdict: '',
      reason: '',
      evidence_summary: '',
      created_at: 1718223932,
      evaluated_at: 0
    });
    expect(() => parseRequestJson(invalidTypes)).toThrow();
  });
});

describe('JSON Attestations Parser', () => {
  test('parses valid list response', () => {
    const list = [
      {
        request_id: 1,
        owner: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
        skill: 'React',
        github_username: 'octocat',
        repo_url_1: 'https://github.com/octocat/repo1',
        repo_url_2: '',
        repo_url_3: '',
        status: 'FINALIZED',
        verdict: 'SUPPORTED',
        reason: 'Good codebase structure.',
        evidence_summary: 'Clean components files found.',
        created_at: 1718223932,
        evaluated_at: 1718225000
      }
    ];
    const parsed = parseAttestationsJson(JSON.stringify(list));
    expect(parsed.length).toBe(1);
    expect(parsed[0].verdict).toBe('SUPPORTED');
  });

  test('parses empty array response', () => {
    const parsed = parseAttestationsJson('[]');
    expect(parsed.length).toBe(0);
  });

  test('throws when status is not FINALIZED', () => {
    const list = [
      {
        request_id: 1,
        owner: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
        skill: 'React',
        github_username: 'octocat',
        repo_url_1: 'https://github.com/octocat/repo1',
        repo_url_2: '',
        repo_url_3: '',
        status: 'SUBMITTED',
        verdict: 'SUPPORTED',
        reason: 'Good codebase structure.',
        evidence_summary: 'Clean components files found.',
        created_at: 1718223932,
        evaluated_at: 1718225000
      }
    ];
    expect(() => parseAttestationsJson(JSON.stringify(list))).toThrow();
  });
});
