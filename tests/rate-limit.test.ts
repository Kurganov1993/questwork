import { describe, it, expect } from 'vitest';

// Копируем логику identifier из rate-limit, чтобы протестировать без БД
function makeIdentifier(heroId: number | undefined, ip: string): string {
  if (heroId) return `hero:${heroId}`;
  return `ip:${ip}`;
}

describe('rate limit identifier', () => {
  it('герой имеет приоритет над IP', () => {
    expect(makeIdentifier(5, '1.2.3.4')).toBe('hero:5');
  });

  it('без героя — IP', () => {
    expect(makeIdentifier(undefined, '1.2.3.4')).toBe('ip:1.2.3.4');
  });

  it('разные герои получают разные идентификаторы', () => {
    expect(makeIdentifier(1, '1.1.1.1')).not.toBe(makeIdentifier(2, '1.1.1.1'));
  });
});