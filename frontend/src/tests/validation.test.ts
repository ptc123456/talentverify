import { describe, test, expect } from 'vitest';
import { validateGitHubUsername, normalizeRepoUrl, validateVerifyForm } from '../lib/validation';

describe('GitHub Username Validation', () => {
  test('valid usernames', () => {
    expect(validateGitHubUsername('octocat')).toBeNull();
    expect(validateGitHubUsername('octo-cat')).toBeNull();
    expect(validateGitHubUsername('octo123')).toBeNull();
  });

  test('invalid usernames', () => {
    expect(validateGitHubUsername('')).toContain('required');
    expect(validateGitHubUsername('a'.repeat(40))).toContain('between 1 and 39');
    expect(validateGitHubUsername('-octocat')).toContain('starts/ends with a hyphen');
    expect(validateGitHubUsername('octocat-')).toContain('starts/ends with a hyphen');
    expect(validateGitHubUsername('octo_cat')).toContain('invalid characters');
  });
});

describe('GitHub Repository URL Normalization', () => {
  test('valid repository URLs', () => {
    const res = normalizeRepoUrl('https://github.com/octocat/hello-world');
    expect(typeof res).not.toBe('string');
    if (typeof res !== 'string') {
      expect(res.owner).toBe('octocat');
      expect(res.repo).toBe('hello-world');
      expect(res.normalized).toBe('https://github.com/octocat/hello-world');
    }

    const resDotGit = normalizeRepoUrl('https://github.com/octocat/hello-world.git');
    expect(typeof resDotGit).not.toBe('string');
    if (typeof resDotGit !== 'string') {
      expect(resDotGit.repo).toBe('hello-world');
    }

    const resSlash = normalizeRepoUrl('https://github.com/octocat/hello-world/');
    expect(typeof resSlash).not.toBe('string');
  });

  test('invalid repository URLs', () => {
    expect(normalizeRepoUrl('http://github.com/octocat/hello-world')).toContain('use HTTPS');
    expect(normalizeRepoUrl('https://github.com/octocat')).toContain('exactly owner and repository');
    expect(normalizeRepoUrl('https://gitlab.com/octocat/hello-world')).toContain('hostname must be exactly github.com');
    expect(normalizeRepoUrl('https://github.com/octocat/hello-world/extra')).toContain('exactly owner and repository');
    expect(normalizeRepoUrl('https://github.com/octocat/hello-world?query=1')).toContain('Query parameters');
    expect(normalizeRepoUrl('https://github.com/octocat/hello-world#fragment')).toContain('Fragments');
    expect(normalizeRepoUrl('https://user:pass@github.com/octocat/hello-world')).toContain('Credentials');
    expect(normalizeRepoUrl('https://github.com:8080/octocat/hello-world')).toContain('Credentials or custom ports');
    expect(normalizeRepoUrl('a'.repeat(201))).toContain('exceeds 200 characters');
  });
});

describe('Verification Form Validation Matrix', () => {
  test('valid form input', () => {
    const { errors, normalizedRepos } = validateVerifyForm(
      'React',
      'octocat',
      'https://github.com/octocat/repo1',
      'https://github.com/octocat/repo2',
      ''
    );
    expect(errors.length).toBe(0);
    expect(normalizedRepos.length).toBe(2);
  });

  test('invalid skill name', () => {
    const { errors } = validateVerifyForm(
      'Ruby',
      'octocat',
      'https://github.com/octocat/repo1',
      '',
      ''
    );
    expect(errors.some(e => e.field === 'skill')).toBe(true);
  });

  test('owner mismatch', () => {
    const { errors } = validateVerifyForm(
      'React',
      'octocat',
      'https://github.com/defunkt/repo1',
      '',
      ''
    );
    expect(errors.some(e => e.field === 'repo_url_1')).toBe(true);
  });

  test('gaps in URL inputs', () => {
    const { errors } = validateVerifyForm(
      'React',
      'octocat',
      'https://github.com/octocat/repo1',
      '',
      'https://github.com/octocat/repo3'
    );
    expect(errors.some(e => e.field === 'repo_url_2')).toBe(true);
  });

  test('duplicate repository URLs', () => {
    const { errors } = validateVerifyForm(
      'React',
      'octocat',
      'https://github.com/octocat/repo1',
      'https://github.com/octocat/repo1',
      ''
    );
    expect(errors.some(e => e.field === 'repo_url_1')).toBe(true);
  });
});
