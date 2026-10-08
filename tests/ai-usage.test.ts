import { describe, it, expect } from 'vitest';
import { estimateCostUsd } from '@/lib/ai/usage';

describe('estimateCostUsd', () => {
  it('считает для gpt-4o-mini', () => {
    const cost = estimateCostUsd('openai/gpt-4o-mini-2024-07-18', 1_000_000, 1_000_000);
    // 0.15 + 0.6 = 0.75
    expect(cost).toBeCloseTo(0.75, 4);
  });

  it('считает для claude-sonnet', () => {
    const cost = estimateCostUsd('anthropic/claude-sonnet-4.6', 1_000_000, 1_000_000);
    // 3 + 15 = 18
    expect(cost).toBeCloseTo(18, 4);
  });

  it('возвращает 0 для неизвестной модели', () => {
    expect(estimateCostUsd('unknown/model', 1_000_000, 1_000_000)).toBe(0);
  });

  it('считает за маленький запрос', () => {
    const cost = estimateCostUsd('openai/gpt-4o-mini-2024-07-18', 1500, 1200);
    // (1500/1e6)*0.15 + (1200/1e6)*0.6 = 0.000225 + 0.00072 = 0.000945
    expect(cost).toBeCloseTo(0.000945, 6);
  });
});