export type StaticIssue = {
  file: string;
  line?: number;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

export type SemgrepFinding = {
  file: string;
  line: number;
  rule: string;
  severity: string;
  message: string;
};

export type PhaseResult = {
  order: number;
  name: string;
  description: string;
  maxHp: number;
  damage: number;
  passed: boolean;
  logs: string[];
  details?: {
    staticIssues?: StaticIssue[];
    semgrepFindings?: SemgrepFinding[];
    metrics?: Record<string, number>;
  };
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