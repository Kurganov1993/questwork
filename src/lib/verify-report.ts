import type {
  VerifyReport,
  PhaseResult,
  PhaseDetails,
  AIReviewDetails,
} from './types';

/**
 * Обрезает отчёт перед сохранением в БД.
 *
 * Зачем: Neon free tier рвёт соединение на больших JSON (>15–20 KB).
 * Полный отчёт (60 KB) с логами Docker, ESLint-issues и AI-ревью
 * не влезает в INSERT. Клиенту уходит полный отчёт, в БД — компактный.
 */
export function slimReport(report: VerifyReport): VerifyReport {
  return {
    repoUrl: report.repoUrl,
    totalDamage: report.totalDamage,
    bossMaxHp: report.bossMaxHp,
    victory: report.victory,
    summary: report.summary,
    loot: report.loot,
    xpGained: report.xpGained,
    goldGained: report.goldGained,
    achievementsGained: report.achievementsGained,
    achievementXp: report.achievementXp,
    achievementGold: report.achievementGold,
    phases: report.phases.map(slimPhase),
  };
}

function slimPhase(p: PhaseResult): PhaseResult {
  return {
    order: p.order,
    name: p.name,
    description: p.description,
    maxHp: p.maxHp,
    damage: p.damage,
    passed: p.passed,
    logs: p.logs.slice(0, 6),
    details: slimDetails(p.details),
  };
}

function slimDetails(details: PhaseDetails | undefined): PhaseDetails | undefined {
  if (!details) return undefined;

  const out: PhaseDetails = {};

  if (details.metrics) {
    out.metrics = details.metrics;
  }

  if (details.containerReason) {
    out.containerReason = details.containerReason;
  }

  if (details.containerLogs && details.containerLogs.length > 0) {
    out.containerLogs = details.containerLogs.slice(-5);
  }

  if (details.staticIssues && details.staticIssues.length > 0) {
    out.staticIssues = details.staticIssues.slice(0, 10).map((i) => ({
      ...i,
      message: i.message.slice(0, 150),
    }));
  }

  if (details.semgrepFindings && details.semgrepFindings.length > 0) {
    out.semgrepFindings = details.semgrepFindings.slice(0, 5).map((f) => ({
      ...f,
      message: f.message.slice(0, 150),
    }));
  }

  if (details.aiReview) {
    out.aiReview = slimAIReview(details.aiReview);
  }

  return out;
}

function slimAIReview(ai: AIReviewDetails): AIReviewDetails {
  return {
    score: ai.score,
    summary: ai.summary.slice(0, 300),
    strengths: ai.strengths.slice(0, 5).map((s) => s.slice(0, 200)),
    issues: ai.issues.slice(0, 10).map((i) => ({
      ...i,
      message: i.message.slice(0, 200),
      suggestion: i.suggestion.slice(0, 200),
    })),
    provider: ai.provider,
    model: ai.model,
    durationMs: ai.durationMs,
  };
}