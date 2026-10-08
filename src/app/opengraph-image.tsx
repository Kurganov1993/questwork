import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'QuestWork — найм как рейд';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
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
            left: '-200px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'rgba(251, 191, 36, 0.18)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-200px',
            right: '-200px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
          }}
        />

        {/* Логотип */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '14px',
              background: 'rgba(251, 191, 36, 0.2)',
              border: '2px solid rgba(251, 191, 36, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fbbf24',
              fontSize: '36px',
              fontWeight: 700,
            }}
          >
            Q
          </div>
          <div
            style={{
              color: '#e5e5e5',
              fontSize: '28px',
              fontWeight: 600,
              letterSpacing: '5px',
              display: 'flex',
            }}
          >
            QUESTWORK
          </div>
        </div>

        {/* Заголовок */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              color: '#71717a',
              fontSize: '20px',
              letterSpacing: '6px',
              marginBottom: '24px',
              fontFamily: 'monospace',
              display: 'flex',
            }}
          >
            НАЙМ КАК РЕЙД
          </div>
          <div
            style={{
              color: '#e5e5e5',
              fontSize: '76px',
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ display: 'flex' }}>Прокачай героя.</span>
            <span style={{ display: 'flex' }}>Победи босса.</span>
            <span style={{ color: '#fbbf24', display: 'flex' }}>
              Получи работу.
            </span>
          </div>
        </div>

        {/* Нижняя строка */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '28px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            color: '#71717a',
            fontSize: '20px',
          }}
        >
          <div style={{ display: 'flex' }}>
            Docker · ESLint · AI-ревью
          </div>
          <div style={{ color: '#fbbf24', display: 'flex' }}>
            questwork.app →
          </div>
        </div>
      </div>
    ),
    size,
  );
}