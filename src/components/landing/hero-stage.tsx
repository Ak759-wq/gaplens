export function HeroStage() {
  return (
    <div className="hero-stage pointer-events-none absolute inset-0 -z-0 overflow-hidden" aria-hidden="true">
      <div className="hero-binary absolute inset-0 select-none whitespace-pre-wrap text-[9px] leading-[1.8] tracking-[0.28em] text-[#c78cff]" />
      <div className="hero-aurora hero-aurora-left absolute -left-[18%] top-[12%] h-[28rem] w-[42rem] rounded-full" />
      <div className="hero-aurora hero-aurora-right absolute -right-[22%] top-[18%] h-[32rem] w-[48rem] rounded-full" />
      <div className="hero-aurora hero-aurora-center absolute left-1/2 top-[43%] h-[32rem] w-[52rem] -translate-x-1/2 rounded-full" />

      <svg className="hero-wave absolute left-1/2 top-[42%] h-[54%] w-[150%] min-w-[1000px] -translate-x-1/2 overflow-visible sm:top-[40%] sm:h-[58%]" viewBox="0 0 1600 700" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hero-wave-fill" x1="180" y1="160" x2="1390" y2="580" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff91c8" stopOpacity=".78" />
            <stop offset=".34" stopColor="#d783ff" stopOpacity=".88" />
            <stop offset=".7" stopColor="#7b48ff" stopOpacity=".86" />
            <stop offset="1" stopColor="#3b1a86" stopOpacity=".3" />
          </linearGradient>
          <linearGradient id="hero-wave-edge" x1="80" y1="180" x2="1480" y2="390" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffb3da" stopOpacity=".25" />
            <stop offset=".5" stopColor="#e0a1ff" />
            <stop offset="1" stopColor="#8b6aff" stopOpacity=".18" />
          </linearGradient>
          <filter id="hero-wave-blur" x="-20%" y="-30%" width="140%" height="170%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>
        <path d="M-100 285C180 120 330 185 520 290C760 422 842 128 1110 170C1330 205 1450 356 1710 270V800H-100V285Z" fill="url(#hero-wave-fill)" filter="url(#hero-wave-blur)" opacity=".72" />
        <path d="M-100 250C170 82 336 156 530 268C755 398 854 108 1115 154C1342 194 1475 330 1710 244" stroke="url(#hero-wave-edge)" strokeWidth="2.2" opacity=".8" />
        <path d="M-100 296C170 128 340 197 520 304C760 438 846 151 1110 196C1335 234 1474 376 1710 285" stroke="#f8c7ff" strokeOpacity=".22" strokeWidth="1" />
      </svg>

      <div className="hero-noise absolute inset-0 opacity-[0.16]" />
      <div className="hero-vignette absolute inset-0" />
    </div>
  );
}
