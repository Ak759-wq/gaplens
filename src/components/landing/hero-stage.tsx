/** Weighted toward binary, with a few hex glyphs so it reads as data, not prose. */
const DIGITS = "00000011111188889999ABCDEF";

/** Deterministic PRNG so the matrix is stable between renders and builds. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeRow(seed: number, length: number) {
  const rand = seeded(seed);
  let row = "";
  for (let i = 0; i < length; i += 1) {
    row += rand() < 0.1 ? " " : DIGITS[Math.floor(rand() * DIGITS.length)];
  }
  return row;
}

const MATRIX_ROWS = Array.from({ length: 28 }, (_, index) => {
  const rand = seeded(index * 97 + 13);
  return {
    text: makeRow(index * 131 + 7, 220),
    top: index * 2.4,
    opacity: 0.3 + rand() * 0.22,
    duration: 38 + rand() * 26,
    delay: -rand() * 40,
  };
});

/**
 * The horizon: a glowing dune ridge that rises at both edges and dips through the
 * centre, echoing the reference's flowing fabric. ViewBox is 1600×760.
 */
const CREST =
  "M -140 190 C 110 60 320 80 500 240 C 650 355 740 405 840 408 C 950 410 1040 315 1180 225 C 1340 120 1520 100 1740 195";
const SECOND_CREST =
  "M -140 268 C 120 148 330 165 520 305 C 670 420 760 470 850 472 C 960 474 1050 380 1190 292 C 1350 190 1520 170 1740 275";
const THIRD_CREST =
  "M -140 350 C 130 235 340 250 530 380 C 680 490 770 540 860 542 C 970 544 1060 450 1200 362 C 1360 260 1520 240 1740 355";

export function HeroStage() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Pale lavender sky that the digital rain hangs in */}
      <div className="hero-sky" />

      {/* Halo: the pink/violet ring that rims the dark stage */}
      <div className="hero-halo" />
      <div className="hero-aurora hero-aurora-left" />
      <div className="hero-aurora hero-aurora-right" />

      {/* Digital matrix sits between the sky and the dark stage, so it fades
          into the centre exactly as it does in the reference. */}
      <div className="hero-matrix">
        {MATRIX_ROWS.map((row, index) => (
          <div
            key={index}
            className="hero-matrix-row"
            style={{
              top: `${row.top}%`,
              opacity: row.opacity,
              animationDuration: `${row.duration}s`,
              animationDelay: `${row.delay}s`,
            }}
          >
            {row.text}
          </div>
        ))}
      </div>

      {/* Dark central stage that keeps the headline readable */}
      <div className="hero-stage-oval" />
      <div className="hero-aurora hero-aurora-core" />

      <div className="hero-wave-glow" />

      <svg className="hero-wave" viewBox="0 0 1600 760" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hero-wave-rim" x1="0" y1="300" x2="1600" y2="300" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f5c2ff" stopOpacity="0.7" />
            <stop offset="0.12" stopColor="#ffb3e6" stopOpacity="1" />
            <stop offset="0.28" stopColor="#ffc4ee" stopOpacity="1" />
            <stop offset="0.45" stopColor="#e879f9" stopOpacity="0.62" />
            <stop offset="0.55" stopColor="#d946ef" stopOpacity="0.55" />
            <stop offset="0.72" stopColor="#f472b6" stopOpacity="0.9" />
            <stop offset="0.88" stopColor="#ffb3e6" stopOpacity="1" />
            <stop offset="1" stopColor="#e0a6ff" stopOpacity="0.7" />
          </linearGradient>
          <filter id="hero-wave-ambient" x="-30%" y="-120%" width="160%" height="340%">
            <feGaussianBlur stdDeviation="46" />
          </filter>
          <filter id="hero-wave-soft" x="-20%" y="-80%" width="140%" height="260%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <filter id="hero-wave-band" x="-10%" y="-60%" width="120%" height="220%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="hero-wave-sharp" x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>
        {/* Ambient haze, offset down so nothing glows above the crest. */}
        <path d={CREST} transform="translate(0 52)" stroke="url(#hero-wave-rim)" strokeWidth="80" strokeOpacity="0.14" filter="url(#hero-wave-soft)" />
        {/* Ribbon body: top edge sits exactly on the crest. */}
        <path d={CREST} transform="translate(0 24)" stroke="url(#hero-wave-rim)" strokeWidth="52" strokeOpacity="0.8" filter="url(#hero-wave-band)" />
        {/* Crisp crest line. */}
        <path d={CREST} stroke="url(#hero-wave-rim)" strokeWidth="4" strokeOpacity="1" filter="url(#hero-wave-sharp)" />
        <path d={SECOND_CREST} stroke="#c084fc" strokeWidth="1.8" strokeOpacity="0.16" />
        <path d={THIRD_CREST} stroke="#8b5cf6" strokeWidth="1.4" strokeOpacity="0.09" />
        <path d={CREST} stroke="#ffe4fb" strokeWidth="1.2" strokeOpacity="0.45" filter="url(#hero-wave-sharp)" />
      </svg>

      <div className="hero-wave-grain" />
      <div className="hero-grain" />
      <div className="hero-vignette" />
    </div>
  );
}
