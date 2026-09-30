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
    containerLogs?: string[];
    containerReason?: string;
  };
};

export type LootItem = {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  isNew: boolean;
};

export type EarnedAchievementItem = {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  goldReward: number;
};

export type VerifyReport = {
  repoUrl: string;
  totalDamage: number;
  bossMaxHp: number;
  victory: boolean;
  phases: PhaseResult[];
  summary: string;
  loot?: LootItem[];
  xpGained?: number;
  goldGained?: number;
  achievementsGained?: EarnedAchievementItem[];
  achievementXp?: number;
  achievementGold?: number;
};

export type VerifyResponse =
  | { ok: true; submissionId: number; report: VerifyReport }
  | { ok: false; error: string };