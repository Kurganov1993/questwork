import { db } from '@/db';
import { artifacts, heroArtifacts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withRetry } from './db-retry';
import type { LootItem } from './types';

export async function awardQuestArtifacts(
  heroId: number,
  questId: number,
): Promise<LootItem[]> {
  const questArtifacts = await withRetry(
    () =>
      db.select().from(artifacts).where(eq(artifacts.questId, questId)),
    { label: 'loot:select-artifacts' },
  );

  const awarded: LootItem[] = [];

  for (const a of questArtifacts) {
    const [existing] = await withRetry(
      () =>
        db
          .select({ id: heroArtifacts.id })
          .from(heroArtifacts)
          .where(
            and(
              eq(heroArtifacts.heroId, heroId),
              eq(heroArtifacts.artifactId, a.id),
            ),
          )
          .limit(1),
      { label: 'loot:check-existing' },
    );

    const isNew = !existing;

    if (isNew) {
      // Идемпотентная вставка: ON CONFLICT DO NOTHING
      await withRetry(
        () =>
          db
            .insert(heroArtifacts)
            .values({ heroId, artifactId: a.id })
            .onConflictDoNothing(),
        { label: 'loot:insert' },
      );
    }

    awarded.push({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      icon: a.icon,
      rarity: a.rarity as LootItem['rarity'],
      isNew,
    });
  }

  return awarded;
}