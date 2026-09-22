'use client';

import { HeroSprite } from './sprites/HeroSprite';
import { BossSprite } from './sprites/BossSprite';
import { HpBar } from './HpBar';

type AnimState = 'idle' | 'attack' | 'hit' | 'victory' | 'defeated';

type Props = {
  heroClass:
    | 'frontend_mage' | 'backend_warrior' | 'devops_paladin'
    | 'qa_rogue' | 'designer_bard' | 'pm_druid';
  heroName: string;
  heroHp: number;
  heroMaxHp: number;
  heroAnim: AnimState;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossAnim: AnimState;
  damagePopup: { value: number; key: number } | null;
};

const animClass = (s: AnimState) =>
  s === 'attack'  ? 'qw-anim-attack'   :
  s === 'hit'     ? 'qw-anim-hit'      :
  s === 'victory' ? 'qw-anim-victory'  :
  s === 'defeated'? 'qw-anim-defeated' :
  'qw-anim-idle';

export function BattleScene({
  heroClass, heroName, heroHp, heroMaxHp, heroAnim,
  bossName, bossHp, bossMaxHp, bossAnim, damagePopup,
}: Props) {
  return (
    <div className="relative rounded-xl border border-zinc-800 bg-gradient-to-b from-indigo-950/40 via-zinc-950 to-black overflow-hidden">
      {/* Дальний фон: горы/луна */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 right-10 w-12 h-12 rounded-full bg-amber-200/20 blur-md" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* Пол арены */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-zinc-900/70 border-t border-zinc-800" />
      <div
        className="absolute bottom-16 left-0 right-0 h-px bg-amber-500/20"
        style={{ animation: 'qw-ground-pulse 3s ease-in-out infinite' }}
      />

      <div className="relative grid grid-cols-2 gap-4 px-6 pt-6 pb-6 min-h-[280px]">
        {/* ГЕРОЙ */}
        <div className="flex flex-col items-center justify-end gap-3">
          <div className="w-full max-w-[220px]">
            <HpBar hp={heroHp} maxHp={heroMaxHp} label={heroName} />
          </div>
          <div className={`relative w-32 h-32 sm:w-40 sm:h-40 ${animClass(heroAnim)}`}>
            <HeroSprite heroClass={heroClass} />
          </div>
        </div>

        {/* БОСС */}
        <div className="flex flex-col items-center justify-end gap-3">
          <div className="w-full max-w-[220px]">
            <HpBar hp={bossHp} maxHp={bossMaxHp} label={bossName} align="right" />
          </div>
          <div className={`relative w-40 h-40 sm:w-52 sm:h-52 ${animClass(bossAnim)}`}>
            <BossSprite defeated={bossAnim === 'defeated'} />

            {/* Поп-ап урона над боссом */}
            {damagePopup && (
              <div
                key={damagePopup.key}
                className="absolute -top-2 right-2 text-2xl font-bold text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.9)] pointer-events-none"
                style={{ animation: 'qw-damage-pop 1s ease-out forwards' }}
              >
                -{damagePopup.value}
              </div>
            )}
          </div>
        </div>

        {/* Вспышка-слэш посередине при атаке героя */}
        {heroAnim === 'attack' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="text-6xl"
              style={{ animation: 'qw-slash 0.55s ease-out forwards' }}
            >
              ⚡
            </div>
          </div>
        )}
      </div>
    </div>
  );
}