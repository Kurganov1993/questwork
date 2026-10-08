import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { heroes } from '@/db/schema';
import { getCurrentHero } from '@/lib/auth';
import { withRetry } from '@/lib/db-retry';
import { HeroBackground } from '@/components/home/HeroBackground';
import { HeroEmailSettings } from '@/components/hero/HeroEmailSettings';

export const dynamic = 'force-dynamic';

export default async function HeroSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  const hero = await getCurrentHero();
  if (!hero) redirect('/login');

  const { verify } = await searchParams;

  const [row] = await withRetry(
    () =>
      db
        .select({
          email: heroes.email,
          emailVerifiedAt: heroes.emailVerifiedAt,
          notifyByEmail: heroes.notifyByEmail,
        })
        .from(heroes)
        .where(eq(heroes.id, hero.id)),
    { label: 'hero-settings:load' },
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="relative overflow-hidden">
        <HeroBackground />

        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-20">
          <Link
            href="/hero"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition"
          >
            ← В профиль
          </Link>

          <h1 className="text-3xl sm:text-4xl font-bold mt-6 mb-3">
            Настройки
          </h1>
          <p className="text-zinc-400 mb-8">
            Управляй email-уведомлениями и подключёнными сервисами.
          </p>

          {verify === 'success' && (
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4 text-sm text-emerald-300 mb-6">
              ✓ Email подтверждён
            </div>
          )}
          {verify === 'error' && (
            <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4 text-sm text-red-300 mb-6">
              Не удалось подтвердить email. Попробуй ещё раз.
            </div>
          )}

          <HeroEmailSettings
            initialEmail={row?.email ?? null}
            initialVerified={!!row?.emailVerifiedAt}
            initialNotify={row?.notifyByEmail ?? true}
          />

          <div className="glass rounded-2xl p-6 mt-4">
            <div className="font-semibold mb-1">Экспорт данных</div>
            <div className="text-xs text-zinc-500 mb-4">
              Скачай все свои данные в формате JSON: профиль, историю сдач,
              артефакты, достижения. Соответствует праву на доступ к своим
              персональным данным (152-ФЗ, ст. 14).
            </div>
            <a
              href="/api/hero/export"
              className="inline-block px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-sm hover:border-amber-500/60 hover:text-amber-400 transition"
              download
            >
              📥 Скачать мои данные (JSON)
            </a>
          </div>

          <div className="glass rounded-2xl p-6 mt-4">
            <div className="font-semibold mb-1">GitHub</div>
            <div className="text-xs text-zinc-500 mb-4">
              Подключи GitHub, чтобы сдавать квесты в один клик — выбирая
              репозиторий из списка вместо копирования ссылок.
            </div>
            <Link
              href="/hero/github"
              className="inline-block px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 text-sm hover:border-amber-500/60 hover:text-amber-400 transition"
            >
              🐙 Перейти к репозиториям →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}