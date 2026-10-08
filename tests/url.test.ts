import { describe, it, expect } from 'vitest';
import { parseRepoUrl } from '@/lib/github';

describe('parseRepoUrl', () => {
  it('парсит обычный URL', () => {
    expect(parseRepoUrl('https://github.com/user/repo')).toEqual({
      owner: 'user',
      repo: 'repo',
    });
  });

  it('парсит URL с .git', () => {
    expect(parseRepoUrl('https://github.com/user/repo.git')).toEqual({
      owner: 'user',
      repo: 'repo',
    });
  });

  it('парсит URL с trailing slash', () => {
    expect(parseRepoUrl('https://github.com/user/repo/')).toEqual({
      owner: 'user',
      repo: 'repo',
    });
  });

  it('парсит URL с www', () => {
    expect(parseRepoUrl('https://www.github.com/user/repo')).toEqual({
      owner: 'user',
      repo: 'repo',
    });
  });

  it('возвращает null для не-GitHub URL', () => {
    expect(parseRepoUrl('https://gitlab.com/user/repo')).toBeNull();
  });

  it('возвращает null для мусора', () => {
    expect(parseRepoUrl('not-a-url')).toBeNull();
  });

  it('возвращает null для URL без repo', () => {
    expect(parseRepoUrl('https://github.com/user')).toBeNull();
  });
});