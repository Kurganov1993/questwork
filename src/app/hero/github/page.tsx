import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { githubAccounts } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { isGithubOAuthConfigured } from '@/lib/github-oauth';
import { GitHubRepos } from '@/components/github/GitHubRepos';
import { HeroBackground } from '@/components/home/HeroBackground';
import { DisconnectGithubButton } from '@/components/github/DisconnectGithubButton';

export const dynamic = 'force-dynamic';

export default async function GithubPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const hero = await getCurrentHero();
  if (!hero) redirect('/login');

  const { connected, error } = await searchParams;
  const configured = isGithubOAuthConfigured();

  let account: typeof githubAccounts.$inferSelect | undefined;
  try {
    const rows = await withRetry(
      () =>
        db
          .select()
          .from(githubAccounts)
          .where(eq(githubAccounts.heroId, hero.id)),
      { label: 'github:page-account' },
    );
    account = rows[0];
  } catch (e) {
    console.error('[github/page]', e);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-10">
          <Link
            href="/hero"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
          >
            ← Мой профиль
          </Link>

          <div className="mt-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-amber-300 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-dot" />
              <span className="tracking-widest font-mono">GITHUB</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-3">
              Мои <span className="text-gradient-amber">репозитории</span>
            </h1>
            <p className="text-zinc-400 max-w-xl">
              Подключи GitHub и сдавай квесты в один клик — без копирования ссылок.
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
              Ошибка: {decodeURIComponent(error)}
            </div>
          )}

          {connected === '1' && (
            <div className="mt-6 rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">
              ✓ GitHub подключён. Теперь выбирай репозиторий и сдавай квест.
            </div>
          )}

          {!configured && (
            <div className="mt-6 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-200">
              <div className="font-semibold mb-1">GitHub OAuth не настроен</div>
              <div className="text-amber-300/80 text-xs">
                Добавь <code className="font-mono">GITHUB_OAUTH_CLIENT_ID</code> и{' '}
                <code className="font-mono">GITHUB_OAUTH_CLIENT_SECRET</code> в{' '}
                <code className="font-mono">.env.local</code>. Инструкция в README.
              </div>
            </div>
          )}

          {configured && (
            <div className="mt-8">
              {account ? (
                <>
                  <div className="glass rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      {account.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={account.avatarUrl}
                          alt={account.githubUsername}
                          className="w-12 h-12 rounded-full border border-white/10"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 grid place-items-center text-xl">
                          🐙
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">
                          @{account.githubUsername}
                        </div>
                        <div className="text-xs text-zinc-500">
                          подключён
                        </div>
                      </div>
                    </div>
                    <DisconnectGithubButton />
                  </div>

                  <GitHubRepos />
                </>
              ) : (
                <div className="glass-strong rounded-3xl p-10 text-center relative overflow-hidden">
                  <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-amber-500/15 blur-[100px] animate-pulse-glow" />
                  <div className="relative">
                    <div className="text-5xl mb-5">🐙</div>
                    <h2 className="text-2xl font-bold mb-3">
                      Подключи GitHub
                    </h2>
                    <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                      После подключения появится список твоих репозиториев.
                      Сдача квеста — в один клик.
                    </p>
                    <a
                      href="/api/auth/github"
                      className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-[0_0_40px_-10px_rgba(251,191,36,0.6)]"
                    >
                      Подключить GitHub
                    </a>
                    <div className="mt-6 text-xs text-zinc-500 max-w-sm mx-auto">
                      Мы запросим доступ к списку репозиториев. Сможешь отозвать в
                      любой момент в настройках GitHub.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}