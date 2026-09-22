export function BossSprite({ defeated = false }: { defeated?: boolean }) {
  return (
    <svg viewBox="0 0 96 96" width="100%" height="100%" shapeRendering="crispEdges">
      {/* shadow */}
      <ellipse cx="48" cy="90" rx="28" ry="4" fill="#000" opacity="0.5" />

      {/* robe body */}
      <path d="M20 44 Q48 32 76 44 L82 88 L14 88 Z" fill="#3b0764" />
      <path d="M20 44 Q48 32 76 44 L78 52 L18 52 Z" fill="#5b21b6" />

      {/* gold trim */}
      <rect x="18" y="60" width="60" height="3" fill="#a16207" />
      <rect x="16" y="74" width="64" height="3" fill="#a16207" />

      {/* coins on robe */}
      <circle cx="30" cy="68" r="3" fill="#facc15" />
      <circle cx="48" cy="68" r="3" fill="#facc15" />
      <circle cx="66" cy="68" r="3" fill="#facc15" />

      {/* arms */}
      <rect x="6" y="48" width="12" height="28" rx="3" fill="#3b0764" />
      <rect x="78" y="48" width="12" height="28" rx="3" fill="#3b0764" />
      {/* hands */}
      <circle cx="12" cy="78" r="4" fill="#f4c9a0" />
      <circle cx="84" cy="78" r="4" fill="#f4c9a0" />

      {/* staff in right hand */}
      <rect x="84" y="18" width="3" height="58" fill="#78350f" />
      <circle cx="85.5" cy="16" r="6" fill="#facc15">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="85.5" cy="16" r="2" fill="#fef08a" />

      {/* head */}
      <circle cx="48" cy="30" r="14" fill="#f4c9a0" />

      {/* beard */}
      <path d="M36 36 Q48 52 60 36 L58 40 Q48 46 38 40 Z" fill="#e5e7eb" />

      {/* eyes — glow red */}
      {!defeated ? (
        <>
          <rect x="42" y="27" width="3" height="3" fill="#dc2626" />
          <rect x="51" y="27" width="3" height="3" fill="#dc2626" />
        </>
      ) : (
        <>
          <path d="M42 27 L45 30 M45 27 L42 30" stroke="#111" strokeWidth="1" />
          <path d="M51 27 L54 30 M54 27 L51 30" stroke="#111" strokeWidth="1" />
        </>
      )}

      {/* crown */}
      <path d="M32 18 L36 8 L40 14 L48 4 L56 14 L60 8 L64 18 Z" fill="#facc15" />
      <rect x="32" y="17" width="32" height="3" fill="#a16207" />
      <circle cx="48" cy="6" r="2" fill="#dc2626" />
      <circle cx="36" cy="10" r="1.5" fill="#0ea5e9" />
      <circle cx="60" cy="10" r="1.5" fill="#0ea5e9" />

      {/* nose */}
      <path d="M47 30 L49 30 L48 33 Z" fill="#d4a373" />
    </svg>
  );
}