export type PhaseResult = {
  order: number;
  name: string;
  description: string;
  maxHp: number;
  damage: number;
  passed: boolean;
  logs: string[];
};

export type VerifyReport = {
  repoUrl: string;
  totalDamage: number;
  bossMaxHp: number;
  victory: boolean;
  phases: PhaseResult[];
  summary: string;
};

export type VerifyResponse =
  | { ok: true; submissionId: number; report: VerifyReport }
  | { ok: false; error: string };