type HeroClass =
  | 'frontend_mage'
  | 'backend_warrior'
  | 'devops_paladin'
  | 'qa_rogue'
  | 'designer_bard'
  | 'pm_druid';

type Palette = {
  primary: string;
  secondary: string;
  accent: string;
  skin: string;
};

const PALETTES: Record<HeroClass, Palette> = {
  frontend_mage:   { primary: '#6d28d9', secondary: '#4c1d95', accent: '#a78bfa', skin: '#f4c9a0' },
  backend_warrior: { primary: '#b91c1c', secondary: '#7f1d1d', accent: '#fca5a5', skin: '#f4c9a0' },
  devops_paladin:  { primary: '#0369a1', secondary: '#075985', accent: '#7dd3fc', skin: '#f4c9a0' },
  qa_rogue:        { primary: '#166534', secondary: '#14532d', accent: '#86efac', skin: '#f4c9a0' },
  designer_bard:   { primary: '#be185d', secondary: '#831843', accent: '#f9a8d4', skin: '#f4c9a0' },
  pm_druid:        { primary: '#4d7c0f', secondary: '#365314', accent: '#bef264', skin: '#f4c9a0' },
};

export function HeroSprite({ heroClass }: { heroClass: HeroClass }) {
  const p = PALETTES[heroClass] ?? PALETTES.frontend_mage;

  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" shapeRendering="crispEdges">
      {/* shadow */}
      <ellipse cx="32" cy="61" rx="16" ry="2.5" fill="#000" opacity="0.4" />

      {/* legs */}
      <rect x="24" y="48" width="6" height="12" fill={p.secondary} />
      <rect x="34" y="48" width="6" height="12" fill={p.secondary} />
      <rect x="23" y="58" width="8" height="3" fill="#111" />
      <rect x="33" y="58" width="8" height="3" fill="#111" />

      {/* torso / robe */}
      <path d="M18 32 Q32 24 46 32 L46 50 L18 50 Z" fill={p.primary} />
      <rect x="22" y="32" width="20" height="3" fill={p.accent} opacity="0.8" />

      {/* arms */}
      <rect x="14" y="34" width="5" height="12" rx="2" fill={p.primary} />
      <rect x="45" y="34" width="5" height="12" rx="2" fill={p.primary} />

      {/* neck */}
      <rect x="29" y="18" width="6" height="4" fill={p.skin} />

      {/* head */}
      <circle cx="32" cy="14" r="9" fill={p.skin} />

      {/* eyes */}
      <rect x="28" y="13" width="2" height="2" fill="#111" />
      <rect x="34" y="13" width="2" height="2" fill="#111" />

      {/* headgear per class */}
      {heroClass === 'frontend_mage' && (
        <>
          <path d="M22 12 L32 -2 L42 12 Z" fill={p.primary} />
          <circle cx="32" cy="-1" r="2" fill={p.accent} />
          <rect x="20" y="11" width="24" height="2" fill={p.secondary} />
        </>
      )}
      {heroClass === 'backend_warrior' && (
        <>
          <path d="M22 10 Q32 2 42 10 L42 14 L22 14 Z" fill="#9ca3af" />
          <rect x="20" y="13" width="24" height="2" fill="#4b5563" />
          <path d="M31 2 L33 2 L33 6 L31 6 Z" fill={p.accent} />
        </>
      )}
      {heroClass === 'devops_paladin' && (
        <>
          <path d="M22 8 Q32 0 42 8 L42 12 L22 12 Z" fill="#cbd5e1" />
          <rect x="22" y="11" width="20" height="2" fill="#64748b" />
        </>
      )}
      {heroClass === 'qa_rogue' && (
        <>
          <path d="M20 12 Q32 -2 44 12 L44 16 L20 16 Z" fill={p.secondary} />
          <ellipse cx="32" cy="13" rx="9" ry="4" fill="#0a0a0a" />
          <rect x="28" y="12" width="2" height="2" fill="#ef4444" />
          <rect x="34" y="12" width="2" height="2" fill="#ef4444" />
        </>
      )}
      {heroClass === 'designer_bard' && (
        <>
          <path d="M22 10 Q32 4 42 10 L42 12 L22 12 Z" fill={p.secondary} />
          <rect x="20" y="11" width="24" height="3" fill={p.accent} />
          <path d="M38 4 L46 8 L40 12 Z" fill={p.accent} />
        </>
      )}
      {heroClass === 'pm_druid' && (
        <>
          <path d="M22 12 Q32 2 42 12 L42 14 L22 14 Z" fill="#166534" />
          <path d="M40 4 Q50 2 52 10 Q46 12 40 8 Z" fill={p.accent} />
        </>
      )}

      {/* weapon per class (right side) */}
      {heroClass === 'frontend_mage' && (
        <>
          <rect x="48" y="20" width="3" height="34" fill="#78350f" />
          <circle cx="49.5" cy="18" r="4" fill={p.accent}>
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {heroClass === 'backend_warrior' && (
        <>
          <rect x="48" y="34" width="3" height="20" fill="#78350f" />
          <rect x="46" y="16" width="7" height="20" fill="#cbd5e1" />
          <rect x="46" y="34" width="7" height="3" fill="#9ca3af" />
        </>
      )}
      {heroClass === 'devops_paladin' && (
        <>
          <rect x="48" y="30" width="3" height="22" fill="#78350f" />
          <rect x="44" y="14" width="12" height="16" fill="#94a3b8" />
          <rect x="47" y="18" width="6" height="2" fill="#e2e8f0" />
          <rect x="49" y="16" width="2" height="12" fill="#e2e8f0" />
          {/* small shield in left hand */}
          <rect x="8" y="30" width="8" height="12" rx="2" fill={p.accent} />
        </>
      )}
      {heroClass === 'qa_rogue' && (
        <>
          <rect x="48" y="36" width="2" height="12" fill="#9ca3af" />
          <path d="M46 36 L52 36 L49 30 Z" fill="#e2e8f0" />
          <rect x="14" y="36" width="2" height="12" fill="#9ca3af" />
          <path d="M12 36 L18 36 L15 30 Z" fill="#e2e8f0" />
        </>
      )}
      {heroClass === 'designer_bard' && (
        <>
          <ellipse cx="50" cy="40" rx="6" ry="9" fill="#a16207" />
          <rect x="48" y="20" width="4" height="20" fill="#78350f" />
          <rect x="47" y="18" width="6" height="3" fill="#fcd34d" />
        </>
      )}
      {heroClass === 'pm_druid' && (
        <>
          <rect x="48" y="20" width="3" height="34" fill="#78350f" />
          <path d="M42 12 Q56 8 58 18 Q50 22 42 18 Z" fill={p.accent} />
        </>
      )}
    </svg>
  );
}