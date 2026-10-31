import { cn } from "@/lib/utils";

/**
 * Static CSS/SVG composition of the hero scene: a glass lens over layered source panels.
 * Shown while the 3D scene loads and whenever WebGL is unavailable.
 */

type Card = {
  className: string;
  dot?: string;
  gap?: boolean;
  broken?: boolean;
  lines: number[];
};

const CARDS: Card[] = [
  { className: "left-[6%] top-[14%] -rotate-[9deg] opacity-80", dot: "bg-emerald-400", lines: [86, 70, 92, 64, 80, 55] },
  { className: "right-[7%] top-[9%] rotate-[8deg] opacity-90", dot: "bg-red-400", broken: true, lines: [78, 90, 60, 84, 72, 66] },
  { className: "left-[30%] top-[30%] -rotate-[2deg] z-10", gap: true, lines: [88, 74, 0, 0, 82, 60] },
  { className: "left-[9%] bottom-[8%] rotate-[6deg] opacity-75", dot: "bg-amber-400", broken: true, lines: [70, 84, 58, 90, 66, 76] },
  { className: "right-[5%] bottom-[12%] -rotate-[7deg] opacity-85", dot: "bg-red-400", lines: [92, 62, 80, 70, 88, 54] },
];

function DocCard({ card }: { card: Card }) {
  return (
    <div
      className={cn(
        "absolute w-[34%] max-w-[190px] min-w-[120px] rounded-2xl border border-white/15 bg-gradient-to-br from-indigo-200/[0.12] to-indigo-400/[0.03] p-[7%] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-[2px] sm:p-4",
        card.className,
      )}
    >
      <div className="mb-1.5 h-2 w-2/5 rounded-full bg-indigo-50/70" />
      <div className="mb-4 h-1.5 w-1/4 rounded-full bg-indigo-50/30" />
      <div className="relative space-y-2.5">
        {card.lines.map((w, i) =>
          w === 0 ? (
            <div key={i} className="h-1.5" />
          ) : card.broken && i % 3 === 1 ? (
            <div key={i} className="flex gap-2" style={{ width: `${w}%` }}>
              <div className="h-1.5 w-1/2 rounded-full bg-indigo-50/30" />
              <div className="h-1.5 w-1/4 rounded-full bg-indigo-50/10" />
            </div>
          ) : (
            <div key={i} className="h-1.5 rounded-full bg-indigo-50/25" style={{ width: `${w}%` }} />
          ),
        )}
        {card.gap && (
          <div className="absolute inset-x-0 top-[38%] h-[26%] rounded-lg border border-dashed border-orange-300/80 bg-orange-400/15 shadow-[0_0_28px_4px_rgba(251,146,60,0.45)]" />
        )}
      </div>
      {card.dot && (
        <span className={cn("absolute top-3 right-3 size-2 rounded-full shadow-[0_0_14px_3px_currentColor]", card.dot)} />
      )}
    </div>
  );
}

export function HeroFallback({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0", className)} aria-hidden="true">
      <div className="absolute inset-0 m-auto aspect-square w-[min(100%,560px)]">
        {/* Contradiction link between the two red nodes */}
        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M84 18 C 70 45, 78 60, 82 82" fill="none" stroke="#f87171" strokeOpacity="0.5" strokeWidth="0.35" strokeDasharray="1.6 1.2" />
        </svg>
        {CARDS.map((c, i) => (
          <DocCard key={i} card={c} />
        ))}
        {/* Lens */}
        <div className="absolute top-1/2 left-1/2 z-20 aspect-square w-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-100/40 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.35),rgba(199,210,254,0.08)_38%,rgba(99,102,241,0.06)_70%,rgba(255,255,255,0.14))] shadow-[inset_0_1px_18px_rgba(255,255,255,0.25),inset_0_-20px_40px_rgba(129,140,248,0.18),0_40px_80px_-30px_rgba(99,102,241,0.55)] backdrop-blur-[3px]">
          <div className="absolute inset-[7%] rounded-full border border-white/10" />
          <div className="absolute top-[14%] left-[22%] h-[10%] w-[30%] -rotate-[28deg] rounded-full bg-white/30 blur-[6px]" />
        </div>
      </div>
    </div>
  );
}
