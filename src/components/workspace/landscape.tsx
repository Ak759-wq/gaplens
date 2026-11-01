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
function Pine({ x, y, scale, opacity, tint = "#8b9a83" }: { x: number; y: number; scale: number; opacity: number; tint?: string }) {
  const h = 60;
  const tiers = [
    { w: 8, top: y - h, bottom: y - h * 0.56 },
    { w: 12, top: y - h * 0.8, bottom: y - h * 0.44 },
    { w: 16, top: y - h * 0.6, bottom: y - h * 0.3 },
    { w: 21, top: y - h * 0.38, bottom: y + 1 },
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`} opacity={opacity}>
      <rect x={x - 1.4} y={y - 10} width="2.8" height="11" fill="#7f8d76" />
      {tiers.map((t, i) => (
        <path
          key={i}
          d={`M ${x} ${t.top} Q ${x + t.w * 0.62} ${t.top + (t.bottom - t.top) * 0.55} ${x + t.w} ${t.bottom} L ${x - t.w} ${t.bottom} Q ${x - t.w * 0.62} ${t.top + (t.bottom - t.top) * 0.55} ${x} ${t.top} Z`}
          fill={i % 2 === 0 ? tint : "#7e8d76"}
        />
      ))}
    </g>
  );
}

export function Landscape() {
  return (
    <svg viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" fill="none" className="size-full">
      <defs>
        {/* Fades into the ivory page at the top, solid ground at the bottom. */}
        <linearGradient id="ls-fade" x1="0" y1="0" x2="0" y2="320" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.3" stopColor="white" stopOpacity="0.4" />
          <stop offset="0.65" stopColor="white" stopOpacity="0.8" />
          <stop offset="1" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id="ls-mask">
          <rect width="1440" height="320" fill="url(#ls-fade)" />
        </mask>
        {/* Soft cream sky that lifts the top of the illustration off the page. */}
        <linearGradient id="ls-sky" x1="0" y1="70" x2="0" y2="320" gradientUnits="userSpaceOnUse">
          <stop stopColor="#eef0e2" stopOpacity="0" />
          <stop offset="0.6" stopColor="#ebeeda" stopOpacity="0.3" />
          <stop offset="1" stopColor="#e6e9d5" stopOpacity="0.5" />
        </linearGradient>
        <filter id="ls-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <filter id="ls-softer" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        {/* Pines get a whisper of blur so they read as painted, not vector-flat. */}
        <filter id="ls-pine" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
      </defs>

      <rect width="1440" height="320" fill="url(#ls-sky)" />

      <g mask="url(#ls-mask)">
        {/* Farthest ridge: palest grey-green, heavily softened. */}
        <path
          d="M -20 182 C 110 132 240 114 372 144 C 512 176 616 100 758 90 C 902 80 1024 150 1164 138 C 1304 126 1400 158 1460 148 L 1460 320 L -20 320 Z"
          fill="#cfd7c6"
          filter="url(#ls-softer)"
          opacity="1"
        />
        {/* Second ridge. */}
        <path
          d="M -20 206 C 130 172 268 182 408 196 C 566 212 652 150 794 156 C 944 162 1058 212 1196 200 C 1318 190 1398 206 1460 198 L 1460 320 L -20 320 Z"
          fill="#bcc7b0"
          filter="url(#ls-soft)"
          opacity="0.85"
        />
        {/* Near hill, left. */}
        <path
          d="M -20 262 C 88 232 198 226 298 242 C 398 258 468 270 556 282 L 556 320 L -20 320 Z"
          fill="#adbc9f"
          filter="url(#ls-soft)"
          opacity="0.7"
        />
        {/* Near hill, right. */}
        <path
          d="M 1460 252 C 1332 222 1212 218 1102 240 C 1002 260 932 274 852 288 L 852 320 L 1460 320 Z"
          fill="#adbc9f"
          filter="url(#ls-soft)"
          opacity="0.7"
        />
        {/* Pale meadow floor the pines stand on. */}
        <path d="M -20 288 C 220 270 430 280 640 292 C 880 304 1120 278 1460 284 L 1460 320 L -20 320 Z" fill="#dfe4d0" opacity="0.7" />

        {/* Conifer clusters hugging the two bottom corners. */}
        <g filter="url(#ls-pine)">
          <Pine x={40} y={310} scale={1.5} opacity={0.5} tint="#93a289" />
          <Pine x={80} y={316} scale={1.15} opacity={0.42} tint="#8b9a83" />
          <Pine x={12} y={318} scale={1.3} opacity={0.4} tint="#8b9a83" />
          <Pine x={114} y={318} scale={0.9} opacity={0.32} tint="#93a289" />

          <Pine x={1392} y={306} scale={1.55} opacity={0.5} tint="#93a289" />
          <Pine x={1352} y={316} scale={1.2} opacity={0.42} tint="#8b9a83" />
          <Pine x={1420} y={318} scale={1.05} opacity={0.4} tint="#8b9a83" />
          <Pine x={1308} y={318} scale={0.95} opacity={0.32} tint="#93a289" />
        </g>

        {/* Small editorial monogram pinned to the bottom-left, above the pines. */}
        <g transform="translate(36 286)" opacity="0.55">
          <circle cx="0" cy="0" r="15" fill="#202322" />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-serif, ui-serif, Georgia, serif)"
            fontSize="15"
            fontWeight={600}
            letterSpacing="0"
            fill="#f7f4ec"
          >
            N
          </text>
        </g>
      </g>
    </svg>
  );
}
