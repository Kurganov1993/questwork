export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Основной градиент неба */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-black" />

      {/* Сетка на фоне */}
      <div className="absolute inset-0 bg-grid opacity-40" />

      {/* Светящиеся орбы */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-amber-500/20 blur-[120px] animate-float" />
      <div className="absolute top-20 -right-40 w-[600px] h-[600px] rounded-full bg-violet-500/15 blur-[140px] animate-float-2" />
      <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[130px] animate-float" />

      {/* Радиальное затемнение сверху вниз */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950" />
    </div>
  );
}