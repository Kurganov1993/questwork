import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { getCurrentHero } from '@/lib/auth';
import { countUnseenNotifications } from '@/lib/notifications';
import { SmoothScroll } from '@/components/animations/SmoothScroll';
import { HeaderNav } from '@/components/layout/HeaderNav';
import { BetaBanner } from '@/components/legal/BetaBanner';
import { CookieBanner } from '@/components/legal/CookieBanner';
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker';
import { PLATFORM } from '@/lib/platform';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-body',
  display: 'swap',
});

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${PLATFORM.name} — ${PLATFORM.tagline}`,
  description: PLATFORM.description,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? `https://${PLATFORM.domain}`,
  ),
  openGraph: {
    title: `${PLATFORM.name} — ${PLATFORM.tagline}`,
    description: PLATFORM.description,
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
    <html lang="ru" className={`dark ${inter.variable} ${grotesk.variable}`}>
      <body
        className={`${inter.className} bg-zinc-950 text-zinc-100 antialiased`}
      >
        <SmoothScroll>
          <BetaBanner />
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
          <CookieBanner />
          <AnalyticsTracker />
        </SmoothScroll>
      </body>
    </html>
  );
}