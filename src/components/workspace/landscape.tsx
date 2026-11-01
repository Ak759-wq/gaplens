/**
 * Soft watercolour landscape that sits at the foot of the workspace page.
 *
 * Deliberately low-contrast so it never competes with the interface above it: the
 * hill bands and pines are drawn in muted sage/grey-greens and faded out toward the
 * top by a mask, so the illustration dissolves into the ivory page rather than
 * ending on a hard edge. Pure inline SVG — no image assets or dependencies, and it
 * scales to any viewport.
 */

/** A single conifer: stacked tiers so the silhouette reads as a pine, not a triangle. */
function Pine({ x, y, scale, opacity }: { x: number; y: number; scale: number; opacity: number }) {
  const h = 46;
  const tiers = [
    { w: 17, top: y - h, bottom: y - h * 0.52 },
    { w: 23, top: y - h * 0.78, bottom: y - h * 0.24 },
    { w: 29, top: y - h * 0.5, bottom: y + 2 },
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`} opacity={opacity}>
      <rect x={x - 1.6} y={y - 8} width="3.2" height="9" fill="#8d9a84" />
      {tiers.map((t, i) => (
        <path
          key={i}
          d={`M ${x} ${t.top} L ${x + t.w} ${t.bottom} L ${x - t.w} ${t.bottom} Z`}
          fill={i % 2 === 0 ? "#96a68c" : "#8b9a83"}
        />
      ))}
    </g>
  );
}

export function Landscape() {
  return (
    // Fixed + pointer-events-none: sits in the lower background of the viewport,
    // behind the content column (which is z-10) so it never covers a field or text.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[46vh] min-h-[260px] overflow-hidden">
      <div
        className="size-full"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 40%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 40%)",
        }}
      >
      <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice" fill="none">
        <defs>
          {/* Everything dissolves into the ivory page at the top. */}
          <linearGradient id="ls-fade" x1="0" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse">
            <stop stopColor="#faf9f6" stopOpacity="1" />
            <stop offset="0.34" stopColor="#faf9f6" stopOpacity="0.2" />
            <stop offset="1" stopColor="#faf9f6" stopOpacity="0" />
          </linearGradient>
          <mask id="ls-mask">
            <rect width="1440" height="300" fill="url(#ls-fade)" />
          </mask>
          <filter id="ls-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
          <filter id="ls-softer" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        <g mask="url(#ls-mask)">
          {/* Farthest ridge: palest grey-green, heavily softened. */}
          <path
            d="M -20 186 C 120 138 250 120 380 148 C 520 178 620 108 760 96 C 900 84 1020 152 1160 140 C 1300 128 1400 158 1460 148 L 1460 320 L -20 320 Z"
            fill="#c9d1c2"
            filter="url(#ls-softer)"
            opacity="0.6"
          />
          {/* Mid ridge. */}
          <path
            d="M -20 214 C 140 176 280 188 420 198 C 580 210 660 152 800 158 C 950 164 1060 214 1200 202 C 1320 192 1400 208 1460 200 L 1460 320 L -20 320 Z"
            fill="#b7c3ac"
            filter="url(#ls-soft)"
            opacity="0.65"
          />
          {/* Near hill, left. */}
          <path
            d="M -20 252 C 90 216 200 208 300 228 C 400 248 470 262 560 276 L 560 320 L -20 320 Z"
            fill="#a8b79b"
            opacity="0.7"
          />
          {/* Near hill, right. */}
          <path
            d="M 1460 244 C 1330 210 1210 206 1100 230 C 1000 252 930 268 850 284 L 850 320 L 1460 320 Z"
            fill="#a8b79b"
            opacity="0.7"
          />

          {/* Conifer clusters hugging the two bottom corners. */}
          <Pine x={58} y={268} scale={1.15} opacity={0.55} />
          <Pine x={96} y={280} scale={0.85} opacity={0.45} />
          <Pine x={26} y={286} scale={0.95} opacity={0.4} />

          <Pine x={1382} y={262} scale={1.25} opacity={0.55} />
          <Pine x={1340} y={278} scale={0.9} opacity={0.45} />
          <Pine x={1414} y={288} scale={0.8} opacity={0.4} />
        </g>
      </svg>
      </div>
    </div>
  );
}
