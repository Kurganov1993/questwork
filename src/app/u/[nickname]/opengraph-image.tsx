import { ImageResponse } from 'next/og';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { heroes } from '@/db/schema';
import { HERO_CLASSES } from '@/lib/constants';

export const runtime = 'nodejs';
export const alt = 'Профиль героя на QuestWork';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const { nickname } = await params;

  let hero: typeof heroes.$inferSelect | undefined;
  try {
    const rows = await db
      .select()
      .from(heroes)
      .where(eq(heroes.nickname, nickname));
    hero = rows[0];
  } catch {
    /* ignore */
  }

  const heroName = hero?.nickname ?? nickname;
  const heroClass = hero?.heroClass ?? 'frontend_mage';
  const cls = HERO_CLASSES.find((c) => c.value === heroClass);
  const icon = cls?.icon ?? '🧙';
  const label = cls?.label ?? 'Герой';
  const level = hero?.level ?? 1;
  const xp = hero?.xp ?? 0;
  const gold = hero?.gold ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '70px',
          background:
            'linear-gradient(135deg, #0a0a0a 0%, #18181b 50%, #0a0a0a 100%)',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            right: '-200px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
          }}
        />

        {/* Логотип */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'rgba(251, 191, 36, 0.2)',
              border: '2px solid rgba(251, 191, 36, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fbbf24',
              fontSize: '32px',
              fontWeight: 700,
            }}
          >
            Q
          </div>
          <div
            style={{
              color: '#e5e5e5',
              fontSize: '24px',
              fontWeight: 600,
              letterSpacing: '4px',
              display: 'flex',
            }}
          >
            QUESTWORK
          </div>
        </div>

        {/* Основной блок */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '50px',
          }}
        >
          <div
            style={{
              width: '220px',
              height: '220px',
              borderRadius: '50%',
              background:
                'linear-gradient(135deg, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.05) 100%)',
              border: '4px solid rgba(251, 191, 36, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '120px',
            }}
          >
            {icon}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
            }}
          >
            <div
              style={{
                color: '#71717a',
                fontSize: '20px',
                letterSpacing: '4px',
                marginBottom: '12px',
                fontFamily: 'monospace',
                display: 'flex',
              }}
            >
              {label.toUpperCase()}
            </div>
            <div
              style={{
                color: '#e5e5e5',
                fontSize: '72px',
                fontWeight: 700,
                lineHeight: 1,
                marginBottom: '30px',
                display: 'flex',
              }}
            >
              {heroName}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <Stat icon="🧙" label={`Уровень ${level}`} />
              <Stat icon="✨" label={`${xp} XP`} />
              <Stat icon="🪙" label={`${gold}`} />
            </div>
          </div>
        </div>

        {/* Нижняя строка */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '30px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            color: '#71717a',
            fontSize: '20px',
          }}
        >
          <div style={{ display: 'flex' }}>Портфолио как рейд</div>
          <div style={{ color: '#a78bfa', display: 'flex' }}>
            {`questwork.app/u/${heroName} →`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}

function Stat({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 18px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        color: '#a1a1aa',
        fontSize: '20px',
      }}
    >
      <span style={{ display: 'flex' }}>{icon}</span>
      <span style={{ display: 'flex' }}>{label}</span>
    </div>
  );
}