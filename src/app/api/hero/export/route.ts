import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import {
  submissions,
  quests,
  heroArtifacts,
  artifacts,
  heroAchievements,
  achievements as achievementsTable,
} from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const hero = await getCurrentHero();
    if (!hero) {
      return NextResponse.json(
        { ok: false, error: 'Не авторизован' },
        { status: 401 },
      );
    }

    const rl = await checkRateLimit('heroExport', `hero:${hero.id}`);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Слишком много экспортов. Попробуй через ${Math.ceil(
            rl.resetInSec / 60,
          )} мин.`,
        },
        { status: 429 },
      );
    }

    const [subs, arts, achs] = await Promise.all([
      withRetry(
        () =>
          db
            .select({
              id: submissions.id,
              repoUrl: submissions.repoUrl,
              status: submissions.status,
              damageDealt: submissions.damageDealt,
              createdAt: submissions.createdAt,
              employerStatus: submissions.employerStatus,
              employerNote: submissions.employerNote,
              questTitle: quests.title,
              questSlug: quests.slug,
            })
            .from(submissions)
            .leftJoin(quests, eq(quests.id, submissions.questId))
            .where(eq(submissions.heroId, hero.id))
            .orderBy(desc(submissions.createdAt)),
        { label: 'export:subs' },
      ),
      withRetry(
        () =>
          db
            .select({
              name: artifacts.name,
              icon: artifacts.icon,
              description: artifacts.description,
              earnedAt: heroArtifacts.earnedAt,
            })
            .from(heroArtifacts)
            .innerJoin(artifacts, eq(artifacts.id, heroArtifacts.artifactId))
            .where(eq(heroArtifacts.heroId, hero.id)),
        { label: 'export:arts' },
      ),
      withRetry(
        () =>
          db
            .select({
              name: achievementsTable.name,
              icon: achievementsTable.icon,
              description: achievementsTable.description,
              earnedAt: heroAchievements.earnedAt,
            })
            .from(heroAchievements)
            .innerJoin(
              achievementsTable,
              eq(achievementsTable.id, heroAchievements.achievementId),
            )
            .where(eq(heroAchievements.heroId, hero.id)),
        { label: 'export:achs' },
      ),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      format: 'questwork-export-v1',
      hero: {
        id: hero.id,
        nickname: hero.nickname,
        heroClass: hero.heroClass,
        level: hero.level,
        xp: hero.xp,
        gold: hero.gold,
      },
      submissions: subs,
      artifacts: arts,
      achievements: achs,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="questwork-${hero.nickname}-${Date.now()}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    logger.error('export.failed', { message: (e as Error).message });
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка' },
      { status: 500 },
    );
  }
}