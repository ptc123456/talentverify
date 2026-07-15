export interface ValidationError {
  field: string;
  message: string;
}

export function validateGitHubUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'GitHub username is required';
  }
  if (trimmed.length < 1 || trimmed.length > 39) {
    return 'GitHub username length must be between 1 and 39 characters';
  }
  const githubUserRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
  if (!githubUserRegex.test(trimmed)) {
    return 'GitHub username contains invalid characters or starts/ends with a hyphen';
  }
  return null;
}

export function normalizeRepoUrl(url: string): { owner: string; repo: string; normalized: string } | string {
  const trimmed = url.trim();
  if (trimmed.length > 200) {
    return 'Repository URL exceeds 200 characters limit';
  }
  if (anyControlChars(trimmed)) {
    return 'Repository URL contains control or invalid characters';
  }
  if (/\s/.test(trimmed)) {
    return 'Repository URL must not contain whitespace';
  }
  if (trimmed.includes('\\') || trimmed.toLowerCase().includes('%2f') || trimmed.toLowerCase().includes('%5c')) {
    return 'Repository URL contains invalid characters or path traversal';
  }
  if (trimmed.includes('?')) {
    return 'Query parameters in repository URL are not allowed';
  }
  if (trimmed.includes('#')) {
    return 'Fragments in repository URL are not allowed';
  }
  
  let temp = trimmed;
  if (temp.endsWith('/')) {
    if (temp.endsWith('//')) {
      return 'Repository URL contains empty path segments';
    }
    temp = temp.slice(0, -1);
  }
  
  if (!temp.startsWith('https://')) {
    return 'Repository URL must use HTTPS scheme';
  }
  
  const rest = temp.substring(8);
  if (rest.includes('//')) {
    return 'Repository URL contains empty path segments';
  }
  
  const parts = rest.split('/');
  if (!parts.length) {
    return 'Repository URL hostname must be exactly github.com';
  }
  
  const netloc = parts[0];
  if (netloc.includes('@')) {
    return 'Credentials in repository URL are not allowed';
  }
  if (netloc.includes(':')) {
    return 'Credentials or custom ports in repository URL are not allowed';
  }
  if (netloc !== 'github.com') {
    return 'Repository URL hostname must be exactly github.com';
  }
  
  const pathParts = parts.slice(1);
  if (pathParts.some(p => p === '.' || p === '..')) {
    return 'Repository URL contains path traversal or invalid segments';
  }
  if (pathParts.length !== 2) {
    return 'Repository URL must contain exactly owner and repository name, with no extra paths';
  }
  
  const owner = pathParts[0];
  let repo = pathParts[1];
  if (repo.toLowerCase().endsWith('.git')) {
    repo = repo.slice(0, -4);
  }
  
  if (!owner || !repo) {
    return 'Invalid repository owner or name';
  }
  if (owner === '.' || owner === '..' || repo === '.' || repo === '..') {
    return 'Invalid repository owner or name';
  }
  
  if (!/^[a-zA-Z0-9-]+$/.test(owner)) {
    return 'Repository owner contains invalid characters';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return 'Repository name contains invalid characters';
  }
  
  const normalized = `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
  return { owner, repo, normalized };
}

function anyControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 32 || code > 126) {
      return true;
    }
  }
  return false;
}

export function validateVerifyForm(
  skill: string,
  username: string,
  repo1: string,
  repo2: string,
  repo3: string
): { errors: ValidationError[]; normalizedRepos: string[] } {
  const errors: ValidationError[] = [];
  const normalizedRepos: string[] = [];
  
  // 1. Skill
  const allowedSkills = ['React', 'TypeScript', 'Python', 'Solidity', 'Rust'];
  if (!allowedSkills.includes(skill)) {
    errors.push({ field: 'skill', message: 'Selected skill is not supported' });
  }
  
  // 2. Username
  const userErr = validateGitHubUsername(username);
  if (userErr) {
    errors.push({ field: 'github_username', message: userErr });
  }
  
  // 3. Gaps and empty repo1
  const r1 = repo1.trim();
  const r2 = repo2.trim();
  const r3 = repo3.trim();
  
  if (!r1) {
    errors.push({ field: 'repo_url_1', message: 'At least one repository URL must be provided' });
  }
  if (r2 && !r1) {
    errors.push({ field: 'repo_url_1', message: 'First repository URL cannot be empty if the second is provided' });
  }
  if (r3 && !r2) {
    errors.push({ field: 'repo_url_2', message: 'Gap detected in repository inputs: repo 2 is empty but repo 3 is provided' });
  }
  
  // Validate URLs
  const validateUrlField = (val: string, fieldName: string) => {
    if (!val) return;
    const res = normalizeRepoUrl(val);
    if (typeof res === 'string') {
      errors.push({ field: fieldName, message: res });
    } else {
      if (res.owner.toLowerCase() !== username.trim().toLowerCase()) {
        errors.push({ field: fieldName, message: `Repository owner must match GitHub username "${username}" case-insensitively` });
      } else {
        normalizedRepos.push(res.normalized);
      }
    }
  };
  
  validateUrlField(r1, 'repo_url_1');
  validateUrlField(r2, 'repo_url_2');
  validateUrlField(r3, 'repo_url_3');
  
  // Check duplicates
  if (errors.length === 0) {
    const unique = new Set(normalizedRepos);
    if (unique.size !== normalizedRepos.length) {
      errors.push({ field: 'repo_url_1', message: 'Duplicate repository URLs are not allowed' });
    }
  }
  
  return { errors, normalizedRepos };
}
