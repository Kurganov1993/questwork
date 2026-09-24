import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { getCurrentHero } from '@/lib/auth';
import { HERO_CLASSES } from '@/lib/constants';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'QuestWork — найм как рейд',
  description: 'Прокачивай героя, проходи квесты, побеждай боссов.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hero = await getCurrentHero();
  const cls = hero ? HERO_CLASSES.find((c) => c.value === hero.heroClass) : null;

  return (
    <html lang="ru" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}>
        <header className="border-b border-zinc-800/60 px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-amber-500/20 border border-amber-500/40 grid place-items-center text-amber-400 font-bold">
              Q
            </div>
            <span className="font-semibold tracking-wide">QUESTWORK</span>
          </Link>

          <nav className="flex items-center gap-5 text-sm">
            <Link href="/verify" className="text-zinc-400 hover:text-amber-400">
              Квесты
            </Link>

            {hero ? (
              <Link
                href="/hero"
                className="flex items-center gap-3 rounded-md border border-zinc-800 hover:border-amber-500/60 px-3 py-1.5 transition"
              >
                <span className="text-lg">{cls?.icon ?? '🧙'}</span>
                <span className="text-zinc-300">{hero.nickname}</span>
                <span className="text-xs text-amber-400">ур. {hero.level}</span>
                <span className="text-xs text-zinc-400">🪙 {hero.gold}</span>
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-zinc-400 hover:text-amber-400">
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-md bg-amber-500 text-black font-medium hover:bg-amber-400 transition"
                >
                  Создать героя
                </Link>
              </>
            )}
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}