import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getCurrentHero } from '@/lib/auth';
import { countUnseenNotifications } from '@/lib/notifications';
import { SmoothScroll } from '@/components/animations/SmoothScroll';
import { HeaderNav } from '@/components/layout/HeaderNav';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'QuestWork — найм как рейд',
  description:
    'Прокачивай героя, проходи квесты, побеждай боссов. Проверка кода через Docker, ESLint и AI.',
  metadataBase: new URL('https://questwork.app'),
  openGraph: {
    title: 'QuestWork — найм как рейд',
    description:
      'Сдай GitHub-репозиторий — платформа соберёт его в Docker, прогонит тесты и AI-ревью.',
    type: 'website',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hero = await getCurrentHero();
  const unseen = hero ? await countUnseenNotifications(hero.id) : 0;

  return (
    <html lang="ru" className="dark">
      <body
        className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}
      >
        <SmoothScroll>
          <HeaderNav
            hero={
              hero
                ? {
                    id: hero.id,
                    nickname: hero.nickname,
                    heroClass: hero.heroClass,
                    level: hero.level,
                    gold: hero.gold,
                  }
                : null
            }
            unseen={unseen}
          />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}