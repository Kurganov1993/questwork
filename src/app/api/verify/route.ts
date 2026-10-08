import { NextRequest } from 'next/server';
import { db } from '@/db';
import { quests, bossPhases, submissions, heroes } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { runVerification } from '@/lib/verifier';
import { getCurrentHero } from '@/lib/auth';
import { awardQuestArtifacts } from '@/lib/loot';
import { checkAndAwardAchievements } from '@/lib/achievements';
import { withRetry } from '@/lib/db-retry';
import { slimReport } from '@/lib/verify-report';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  acquireBuildSlot,
  getQueuePosition,
  getBuildQueueStats,
} from '@/lib/build-lock';
import { reportError } from '@/lib/error-reporting';
import { logger } from '@/lib/logger';
import type { VerifyReport } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const send = (
    controller: ReadableStreamDefaultController,
    obj: Record<string, unknown>,
  ) => {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
  };

  const stream = new ReadableStream({
    async start(controller) {
      const hero = await getCurrentHero().catch(() => null);
      let releaseSlot: () => void = () => {};

      try {
        if (!hero) {
          send(controller, {
            type: 'error',
            message: 'Нужно войти в аккаунт героя',
          });
          controller.close();
          return;
        }

        // === Rate limit ===
        const rl = await checkRateLimit('verify', `hero:${hero.id}`);
        if (!rl.allowed) {
          send(controller, {
            type: 'error',
            message: `Слишком много проверок. Попробуй через ${Math.ceil(
              rl.resetInSec / 60,
            )} мин.`,
          });
          controller.close();
          return;
        }

        // === Слот сборки ===
        const queuePos = getQueuePosition();
        if (queuePos > 0) {
          send(controller, {
            type: 'queued',
            position: queuePos + 1,
            message: `Ты в очереди: позиция ${queuePos + 1}. Ждём освобождения сборки.`,
          });
        }

        try {
          const slot = await acquireBuildSlot();
          releaseSlot = slot.release;

          if (slot.queuePosition > 0) {
            logger.info('verify.queue.done', {
              heroId: hero.id,
              waitMs: slot.waitMs,
              position: slot.queuePosition,
            });

            send(controller, {
              type: 'queue_done',
              waitMs: slot.waitMs,
            });
          }
        } catch (e) {
          send(controller, {
            type: 'error',
            message: (e as Error).message,
          });
          controller.close();
          return;
        }

        const body = await req.json();
        const { repoUrl, questSlug } = body as {
          repoUrl?: string;
          questSlug?: string;
        };

        if (!repoUrl || typeof repoUrl !== 'string') {
          send(controller, { type: 'error', message: 'repoUrl обязателен' });
          controller.close();
          return;
        }

        const [quest] = await withRetry(
          () =>
            db
              .select()
              .from(quests)
              .where(eq(quests.slug, questSlug ?? 'create-shop')),
          { label: 'verify:get-quest' },
        );

        if (!quest) {
          send(controller, { type: 'error', message: 'Квест не найден' });
          controller.close();
          return;
        }

        const phases = await withRetry(
          () =>
            db
              .select({
                phaseOrder: bossPhases.phaseOrder,
                name: bossPhases.name,
                description: bossPhases.description,
                checkType: bossPhases.checkType,
                maxHp: bossPhases.maxHp,
              })
              .from(bossPhases)
              .where(eq(bossPhases.questId, quest.id)),
          { label: 'verify:get-phases' },
        );

        logger.info('verify.start', {
          heroId: hero.id,
          questSlug: quest.slug,
          queueStats: getBuildQueueStats(),
        });

        send(controller, {
          type: 'start',
          totalPhases: phases.length,
          bossName: quest.bossName,
          bossMaxHp: quest.bossMaxHp,
        });

        const report: VerifyReport = await runVerification(
          repoUrl,
          phases,
          quest.victoryThreshold,
          (phase, index, total) => {
            send(controller, {
              type: 'phase',
              index,
              total,
              order: phase.order,
              name: phase.name,
              description: phase.description,
              passed: phase.passed,
              damage: phase.damage,
              maxHp: phase.maxHp,
              logs: phase.logs,
              details: phase.details,
            });
          },
        );

        logger.info('verify.result', {
          heroId: hero.id,
          totalDamage: report.totalDamage,
          bossMaxHp: report.bossMaxHp,
          victory: report.victory,
        });

        const [submission] = await withRetry(
          () =>
            db
              .insert(submissions)
              .values({
                heroId: hero.id,
                questId: quest.id,
                repoUrl,
                status: report.victory ? 'victory' : 'defeat',
                damageDealt: report.totalDamage,
                report: slimReport(report),
              })
              .returning(),
          { label: 'verify:insert-submission' },
        );

        if (report.victory) {
          try {
            await grantRewards(
              hero.id,
              quest.id,
              quest,
              report,
              submission.id,
            );
          } catch (e) {
            await reportError(e, {
              tags: { route: 'verify', step: 'grantRewards' },
              user: { id: hero.id, nickname: hero.nickname },
            });
          }
        }

        try {
          const perfect = report.totalDamage === report.bossMaxHp;
          const staticPhase = report.phases.find(
            (p) => p.name === 'Статический анализ',
          );
          const cleanEslint =
            !!staticPhase &&
            staticPhase.passed &&
            (staticPhase.details?.metrics?.eslintErrors ?? 0) === 0;

          const achievements = await checkAndAwardAchievements({
            heroId: hero.id,
            currentVictory: report.victory,
            currentPerfect: perfect,
            currentCleanEslint: cleanEslint,
            currentQuestId: quest.id,
            currentQuestSlug: quest.slug,
          });

          if (achievements.length > 0) {
            report.achievementsGained = achievements;
            report.achievementXp = achievements.reduce(
              (s, a) => s + a.xpReward,
              0,
            );
            report.achievementGold = achievements.reduce(
              (s, a) => s + a.goldReward,
              0,
            );
          }
        } catch (e) {
          await reportError(e, {
            tags: { route: 'verify', step: 'achievements' },
            user: { id: hero.id, nickname: hero.nickname },
          });
        }

        send(controller, {
          type: 'done',
          report,
          submissionId: submission.id,
        });

        controller.close();
      } catch (e) {
        await reportError(e, {
          tags: { route: 'api/verify' },
          user: hero ? { id: hero.id, nickname: hero.nickname } : undefined,
        });
        try {
          send(controller, {
            type: 'error',
            message: 'Внутренняя ошибка',
          });
        } catch {
          /* controller может быть уже закрыт */
        }
        controller.close();
      } finally {
        releaseSlot();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function grantRewards(
  heroId: number,
  questId: number,
  quest: typeof quests.$inferSelect,
  report: VerifyReport,
  currentSubmissionId: number,
) {
  const priorVictories = await withRetry(
    () =>
      db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.heroId, heroId),
            eq(submissions.questId, questId),
            eq(submissions.status, 'victory'),
          ),
        ),
    { label: 'reward:prior-victories' },
  );

  const priorWithoutCurrent = priorVictories.filter(
    (s) => s.id !== currentSubmissionId,
  ).length;

  const repeated = priorWithoutCurrent > 0;

  const xpGain = repeated ? Math.floor(quest.rewardXp * 0.2) : quest.rewardXp;
  const goldGain = repeated
    ? Math.floor(quest.rewardGold * 0.2)
    : quest.rewardGold;
  const levelGain = repeated ? 0 : 1;

  await withRetry(
    () =>
      db
        .update(heroes)
        .set({
          xp: sql`${heroes.xp} + ${xpGain}`,
          gold: sql`${heroes.gold} + ${goldGain}`,
          level: sql`${heroes.level} + ${levelGain}`,
        })
        .where(eq(heroes.id, heroId)),
    { label: 'reward:hero-update' },
  );

  const loot = await awardQuestArtifacts(heroId, questId);
  report.loot = loot;
  report.xpGained = xpGain;
  report.goldGained = goldGain;
}