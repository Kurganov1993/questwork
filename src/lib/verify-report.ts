import type { VerifyReport, PhaseResult } from './types';

/**
 * Обрезает отчёт перед сохранением в БД.
 * Полный отчёт нужен только клиенту для UI.
 * В БД кладём компактную версию — Neon free tier рвёт соединение
 * на больших JSON (>15-20 KB).
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
    logs: p.logs.slice(0, 6), // максимум 6 строк в фазе
    details: slimDetails(p.details),
  };
}

function slimDetails(details: PhaseResult['details']) {
  if (!details) return undefined;

  const out: NonNullable<PhaseResult['details']> = {};

  // AI-ревью — оставляем summary и strengths, обрезаем длинные issues
  if (details.aiReview) {
    out.aiReview = {
      ...details.aiReview,
      summary: details.aiReview.summary.slice(0, 300),
      strengths: details.aiReview.strengths.slice(0, 5).map((s) => s.slice(0, 200)),
      issues: details.aiReview.issues.slice(0, 10).map((i) => ({
        ...i,
        message: i.message.slice(0, 200),
        suggestion: i.suggestion.slice(0, 200),
      })),
    };
  }

  // Метрики — оставляем, они мелкие
  if (details.metrics) out.metrics = details.metrics;

  // Логи контейнера — обрезаем до 5 строк
  if (details.containerLogs) {
    out.containerLogs = details.containerLogs.slice(-5);
  }
  if (details.containerReason) out.containerReason = details.containerReason;

  // ESLint issues — оставляем только первые 10, без message > 150 символов
  if (details.staticIssues) {
    out.staticIssues = details.staticIssues.slice(0, 10).map((i) => ({
      ...i,
      message: i.message.slice(0, 150),
    }));
  }

  // Semgrep findings — первые 5
  if (details.semgrepFindings) {
    out.semgrepFindings = details.semgrepFindings.slice(0, 5).map((f) => ({
      ...f,
      message: f.message.slice(0, 150),
    }));
  }

  return out;
}