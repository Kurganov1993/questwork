import type { MetadataRoute } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { quests, heroes } from '@/db/schema';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://questwork.app';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // раз в час

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/quests`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/employer/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/cookies`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  let questPages: MetadataRoute.Sitemap = [];
  try {
    const activeQuests = await db
      .select({
        slug: quests.slug,
        createdAt: quests.createdAt,
      })
      .from(quests)
      .where(eq(quests.status, 'active'));

    questPages = activeQuests.map((q) => ({
      url: `${BASE_URL}/quests/${q.slug}`,
      lastModified: q.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    /* ignore */
  }

  let heroPages: MetadataRoute.Sitemap = [];
  try {
    const publicHeroes = await db
      .select({
        nickname: heroes.nickname,
        createdAt: heroes.createdAt,
      })
      .from(heroes)
      .limit(1000);

    heroPages = publicHeroes.map((h) => ({
      url: `${BASE_URL}/u/${h.nickname}`,
      lastModified: h.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));
  } catch {
    /* ignore */
  }

  return [...staticPages, ...questPages, ...heroPages];
}