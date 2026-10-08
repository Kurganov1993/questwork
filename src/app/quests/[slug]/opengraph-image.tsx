import { ImageResponse } from 'next/og';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { quests } from '@/db/schema';

export const runtime = 'nodejs';
export const alt = 'Квест на QuestWork';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let quest: typeof quests.$inferSelect | undefined;
  try {
    const rows = await db.select().from(quests).where(eq(quests.slug, slug));
    quest = rows[0];
  } catch {
    /* ignore */
  }

  const title = quest?.title ?? 'Квест';
  const bossName = quest?.bossName ?? 'Босс';
  const icon = quest?.icon ?? '⚔️';
  const difficulty = quest?.difficulty ?? 1;
  const xp = quest?.rewardXp ?? 100;
  const gold = quest?.rewardGold ?? 10;
  const hp = quest?.bossMaxHp ?? 100;

  // Звёзды рисуем вручную — у Satori нет дефолтного шрифта для ★
  const starsRow = Array.from({ length: 5 }, (_, i) => i < difficulty);

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
        {/* Свечение в углу */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            right: '-200px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'rgba(251, 191, 36, 0.15)',
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
              fontSize: '180px',
              lineHeight: 1,
              display: 'flex',
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
            {/* Сложность — рисуем звёзды как прямоугольники */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                }}
              >
                {starsRow.map((filled, i) => (
                  <div
                    key={i}
                    style={{
                      width: '18px',
                      height: '18px',
                      background: filled ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                      borderRadius: '3px',
                      display: 'flex',
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  color: '#71717a',
                  fontSize: '18px',
                  letterSpacing: '4px',
                  fontFamily: 'monospace',
                  display: 'flex',
                }}
              >
                {`СЛОЖНОСТЬ ${difficulty}/5`}
              </div>
            </div>

            <div
              style={{
                color: '#e5e5e5',
                fontSize: '64px',
                fontWeight: 700,
                lineHeight: 1.1,
                marginBottom: '24px',
                display: 'flex',
              }}
            >
              {title.length > 40 ? title.slice(0, 37) + '…' : title}
            </div>

            <div
              style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <Stat icon="👑" label={bossName} />
              <Stat icon="❤️" label={`${hp} HP`} />
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
          <div style={{ display: 'flex' }}>Сдай репозиторий — победи босса</div>
          <div style={{ color: '#fbbf24', display: 'flex' }}>
            questwork.app →
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