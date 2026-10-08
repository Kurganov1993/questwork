'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HERO_CLASSES } from '@/lib/constants';

type HeroInfo = {
  id: number;
  nickname: string;
  heroClass: string;
  level: number;
  gold: number;
};

export function HeaderNav({
  hero,
  unseen,
}: {
  hero: HeroInfo | null;
  unseen: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Тень шапки при скролле
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Блокируем прокрутку body при открытом мобильном меню
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Закрываем меню при переходе по ссылке
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Esc закрывает меню
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const cls = hero
    ? HERO_CLASSES.find((c) => c.value === hero.heroClass)
    : null;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Админ определяется через публичную env-переменную
  const isAdmin =
    hero !== null &&
    Number(process.env.NEXT_PUBLIC_ADMIN_HERO_ID ?? 0) === hero.id;

  const NAV = [
    { href: '/quests', label: 'Квесты' },
    { href: '/leaderboard', label: 'Лидерборд' },
    { href: '/employer', label: 'Работодателям' },
    ...(isAdmin ? [{ href: '/admin', label: 'Админ' }] : []),
  ];

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-all duration-300 ${
          scrolled
            ? 'border-white/10 bg-zinc-950/85 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]'
            : 'border-white/5 bg-zinc-950/60'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Логотип */}
          <Link
            href="/"
            className="flex items-center gap-3 group shrink-0"
            aria-label="QuestWork — на главную"
          >
            <div className="w-9 h-9 rounded-md bg-amber-500/20 border border-amber-500/40 grid place-items-center text-amber-400 font-bold group-hover:bg-amber-500/30 group-hover:scale-105 transition-all">
              Q
            </div>
            <span className="font-semibold tracking-wide hidden sm:inline">
              QUESTWORK
            </span>
          </Link>

          {/* Десктопное меню */}
          <nav className="hidden md:flex items-center gap-5 text-sm flex-1 justify-end">
            {NAV.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative py-1 transition ${
                    active
                      ? 'text-amber-400'
                      : link.href === '/admin'
                      ? 'text-red-400/80 hover:text-red-300'
                      : 'text-zinc-400 hover:text-amber-400'
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                  )}
                </Link>
              );
            })}

            {hero ? (
              <div className="flex items-center gap-3 ml-2">
                {unseen > 0 && (
                  <Link
                    href="/hero/invitations"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs hover:bg-amber-500/20 transition"
                    title="Приглашения от компаний"
                  >
                    <span>🔔</span>
                    <span>Приглашения</span>
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                      {unseen}
                    </span>
                  </Link>
                )}

                <Link
                  href="/hero"
                  className="group flex items-center gap-3 rounded-md border border-zinc-800 hover:border-amber-500/60 hover:bg-white/[0.02] px-3 py-1.5 transition"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">
                    {cls?.icon ?? '🧙'}
                  </span>
                  <span className="text-zinc-300">{hero.nickname}</span>
                  <span className="text-xs text-amber-400">
                    ур. {hero.level}
                  </span>
                  <span className="text-xs text-zinc-400 hidden lg:inline">
                    🪙 {hero.gold}
                  </span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3 ml-2">
                <Link
                  href="/login"
                  className="text-zinc-400 hover:text-amber-400 transition"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-md bg-amber-500 text-black font-medium hover:bg-amber-400 transition"
                >
                  Создать героя
                </Link>
              </div>
            )}
          </nav>

          {/* Мобильные элементы */}
          <div className="flex md:hidden items-center gap-2">
            {hero && (
              <Link
                href="/hero"
                className="relative flex items-center gap-2 rounded-md border border-zinc-800 px-2.5 py-1.5"
                aria-label="Профиль героя"
              >
                <span className="text-base">{cls?.icon ?? '🧙'}</span>
                {unseen > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold grid place-items-center">
                    {unseen}
                  </span>
                )}
              </Link>
            )}

            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={mobileOpen}
              className="w-9 h-9 grid place-items-center rounded-md border border-zinc-800 hover:border-amber-500/60 transition"
            >
              {mobileOpen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M4 4L14 14M14 4L4 14"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M3 5H15M3 9H15M3 13H15"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Мобильное меню */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-zinc-950/95 backdrop-blur-xl"
            onClick={() => setMobileOpen(false)}
          />

          <div
            className="relative h-full flex flex-col p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/"
                className="flex items-center gap-3"
                onClick={() => setMobileOpen(false)}
              >
                <div className="w-9 h-9 rounded-md bg-amber-500/20 border border-amber-500/40 grid place-items-center text-amber-400 font-bold">
                  Q
                </div>
                <span className="font-semibold tracking-wide">QUESTWORK</span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Закрыть"
                className="w-9 h-9 grid place-items-center rounded-md border border-zinc-800"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M4 4L14 14M14 4L4 14"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="space-y-2">
              {NAV.map((link) => {
                const active = isActive(link.href);
                const isAdminLink = link.href === '/admin';
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-base transition ${
                      active
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : isAdminLink
                        ? 'text-red-400/80 hover:bg-red-500/5 border border-transparent'
                        : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <span>{link.label}</span>
                    {active && <span className="text-xs">●</span>}
                  </Link>
                );
              })}

              {hero && unseen > 0 && (
                <Link
                  href="/hero/invitations"
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl text-base bg-amber-500/10 text-amber-300 border border-amber-500/30"
                >
                  <span className="flex items-center gap-2">
                    <span>🔔</span>
                    <span>Приглашения</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-xs font-bold">
                    {unseen}
                  </span>
                </Link>
              )}
            </nav>

            <div className="mt-auto pt-8">
              {hero ? (
                <div className="space-y-2">
                  <Link
                    href="/hero"
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/[0.07] transition"
                  >
                    <span className="text-2xl">{cls?.icon ?? '🧙'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {hero.nickname}
                      </div>
                      <div className="text-xs text-zinc-500">
                        ур. {hero.level} · 🪙 {hero.gold}
                      </div>
                    </div>
                    <span className="text-amber-400">→</span>
                  </Link>
                  <Link
                    href={`/u/${hero.nickname}`}
                    className="block px-4 py-3 rounded-xl text-center text-sm text-zinc-400 border border-zinc-800 hover:border-amber-500/60 transition"
                  >
                    Публичный профиль
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    className="block px-4 py-3.5 rounded-xl text-center text-zinc-300 border border-zinc-800 hover:border-amber-500/60 transition"
                  >
                    Войти
                  </Link>
                  <Link
                    href="/register"
                    className="block px-4 py-3.5 rounded-xl text-center bg-amber-500 text-black font-semibold"
                  >
                    Создать героя
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}