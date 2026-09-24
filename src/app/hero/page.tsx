import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { submissions, quests } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { HERO_CLASSES } from '@/lib/constants';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function HeroPage() {
  const hero = await getCurrentHero();
  if (!hero) redirect('/login');

  const cls = HERO_CLASSES.find((c) => c.value === hero.heroClass);

  const mySubs = await db
    .select({
      id: submissions.id,
      repoUrl: submissions.repoUrl,
      status: submissions.status,
      damageDealt: submissions.damageDealt,
      createdAt: submissions.createdAt,
      questTitle: quests.title,
      questSlug: quests.slug,
      bossMaxHp: quests.bossMaxHp,
    })
    .from(submissions)
    .leftJoin(quests, eq(quests.id, submissions.questId))
    .where(eq(submissions.heroId, hero.id))
    .orderBy(desc(submissions.createdAt))
    .limit(20);

  const victories = mySubs.filter((s) => s.status === 'victory').length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-amber-400">
          ← На главную
        </Link>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex items-start gap-5">
            <div className="text-6xl">{cls?.icon ?? '🧙'}</div>
            <div className="flex-1">
              <div className="text-sm text-zinc-500">{cls?.label ?? hero.heroClass}</div>
              <h1 className="text-3xl font-bold">{hero.nickname}</h1>
              <div className="flex gap-6 mt-3 text-sm">
                <div>
                  <div className="text-zinc-500">Уровень</div>
                  <div className="text-2xl font-semibold text-amber-400">
                    {hero.level}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">XP</div>
                  <div className="text-2xl font-semibold">{hero.xp}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Золото</div>
                  <div className="text-2xl font-semibold">🪙 {hero.gold}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Победы</div>
                  <div className="text-2xl font-semibold text-emerald-400">
                    {victories}
                  </div>
                </div>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>

        <h2 className="text-sm text-zinc-500 tracking-widest mt-8 mb-3">
          ИСТОРИЯ ПОХОДОВ
        </h2>

        {mySubs.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-500 text-sm">
            Ты ещё не сдавал квесты. Пора начинать.{' '}
            <Link href="/verify" className="text-amber-400 hover:text-amber-300">
              Взять квест →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {mySubs.map((s) => {
              const pct = Math.round((s.damageDealt / (s.bossMaxHp || 110)) * 100);
              const victory = s.status === 'victory';
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-4 ${
                    victory
                      ? 'border-emerald-800/40 bg-emerald-950/10'
                      : 'border-red-900/40 bg-red-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium">{s.questTitle ?? 'Квест'}</div>
                    <div
                      className={`text-xs px-2 py-0.5 rounded ${
                        victory
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {victory ? 'победа' : 'поражение'} · {pct}%
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 font-mono truncate">
                    {s.repoUrl}
                  </div>
                  <div className="text-xs text-zinc-600 mt-1">
                    {new Date(s.createdAt).toLocaleString('ru-RU')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}