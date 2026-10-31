"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { HeroMotion } from "./hero-starfield";

// three.js + R3F live only in this chunk, fetched after first paint.
const HeroStarfield = dynamic(() => import("./hero-starfield"), { ssr: false, loading: () => null });

/** Deterministic static star layer (first paint, reduced motion, no WebGL). */
function staticStars(count: number, seed: number, w: number, h: number): string {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: string[] = [];
  for (let n = 0; n < count; n++) {
    const a = 0.25 + rnd() * 0.65;
    out.push(`${Math.round(rnd() * w)}px ${Math.round(rnd() * h)}px 0 ${rnd() > 0.92 ? 0.6 : 0}px rgba(235,232,255,${a.toFixed(2)})`);
  }
  return out.join(",");
}
const STARS_A = staticStars(140, 7, 2200, 1200);
const STARS_B = staticStars(60, 101, 2200, 1200);

// Four-point sparkle stars, kept clear of the copy column.
const SPARKLES = [
  { top: "17%", left: "9%", size: 18, delay: "0s" },
  { top: "29%", left: "86%", size: 22, delay: "1.6s" },
  { top: "11%", left: "72%", size: 12, delay: "0.8s" },
  { top: "47%", left: "5%", size: 12, delay: "2.4s" },
  { top: "52%", left: "93%", size: 14, delay: "3.1s" },
];

// Small mint particles drifting up out of the moon's missing wedge.
const MOTES = [
  { x: -1.5, d: 0, dur: 7.5, s: 3 },
  { x: 1.2, d: 1.8, dur: 9, s: 2 },
  { x: -0.4, d: 3.4, dur: 8, s: 2.5 },
  { x: 2.4, d: 5.1, dur: 10, s: 2 },
  { x: -2.6, d: 6.2, dur: 8.5, s: 2 },
  { x: 0.6, d: 4.2, dur: 11, s: 3 },
];

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function HeroStage() {
  const root = useRef<HTMLDivElement>(null);
  const motion = useRef<HeroMotion>({ mx: 0, my: 0, sp: 0 });
  const [gl, setGl] = useState(false);
  const [glReady, setGlReady] = useState(false);
  const [active, setActive] = useState(true);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const section = root.current?.closest("section");
    if (!section) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCompact(window.matchMedia("(max-width: 767px)").matches);

    // Mount WebGL once the page has painted and the main thread is idle.
    let idle = 0;
    if (!reduce && supportsWebGL()) {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
      idle = ric(() => setGl(true), { timeout: 1500 }) as number;
    }

    const io = new IntersectionObserver(([e]) => setActive(Boolean(e?.isIntersecting)), { rootMargin: "80px" });
    io.observe(section);

    if (reduce) return () => io.disconnect();

    // Pointer + scroll drive CSS variables on the section; eased in a rAF loop that sleeps when settled.
    const target = { mx: 0, my: 0, sp: 0 };
    const m = motion.current;
    let raf = 0;
    const tick = () => {
      m.mx += (target.mx - m.mx) * 0.06;
      m.my += (target.my - m.my) * 0.06;
      m.sp += (target.sp - m.sp) * 0.14;
      section.style.setProperty("--mx", m.mx.toFixed(4));
      section.style.setProperty("--my", m.my.toFixed(4));
      section.style.setProperty("--sp", m.sp.toFixed(4));
      const settled =
        Math.abs(target.mx - m.mx) < 0.001 && Math.abs(target.my - m.my) < 0.001 && Math.abs(target.sp - m.sp) < 0.001;
      raf = settled ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      target.mx = (e.clientX / window.innerWidth) * 2 - 1;
      target.my = (e.clientY / window.innerHeight) * 2 - 1;
      kick();
    };
    const onScroll = () => {
      const h = section.offsetHeight || window.innerHeight;
      target.sp = Math.min(1, Math.max(0, window.scrollY / h));
      kick();
    };
    onScroll();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (idle) (window.cancelIdleCallback ?? window.clearTimeout)(idle);
    };
  }, []);

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 -z-0" aria-hidden="true">
      {/* Deep-space tint */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_100%,#1a0f3d_0%,#0a0618_45%,#000_75%)]" />

      {/* Stars: CSS first paint, WebGL takes over when ready */}
      <div className={cn("hero-par-stars absolute inset-0 transition-opacity duration-[1500ms]", glReady && "opacity-0")}>
        <div className="absolute top-0 left-0 size-px rounded-full" style={{ boxShadow: STARS_A }} />
        <div className="absolute top-0 left-0 size-[1.5px] rounded-full opacity-80" style={{ boxShadow: STARS_B }} />
      </div>
      {gl && (
        <div className={cn("absolute inset-0 transition-opacity duration-[1500ms]", glReady ? "opacity-100" : "opacity-0")}>
          <HeroStarfield motion={motion} active={active} compact={compact} onReady={() => setGlReady(true)} />
        </div>
      )}

      {SPARKLES.map((s, n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className={cn("hero-sparkle absolute", n > 2 && "max-md:hidden")}
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }}
        >
          <path d="M12 0C12.9 7.2 16.8 11.1 24 12 16.8 12.9 12.9 16.8 12 24 11.1 16.8 7.2 12.9 0 12 7.2 11.1 11.1 7.2 12 0Z" fill="white" />
        </svg>
      ))}

      {/* Aurora behind the moon's horizon */}
      <div className="hero-par-glow absolute inset-x-0 bottom-0 h-[70%]">
        <div className="hero-glow absolute bottom-[-10%] left-1/2 h-full w-[min(1400px,160vw)] -translate-x-1/2 bg-[radial-gradient(50%_55%_at_50%_80%,rgba(94,234,212,0.16)_0%,rgba(124,92,246,0.14)_45%,transparent_75%)]" />
      </div>

      {/* Focal moon */}
      <div className="hero-par-moon absolute bottom-0 left-1/2 w-[240vw] sm:w-[170vw] md:w-[clamp(960px,min(92vw,140svh),1900px)]">
        <div className="hero-rise relative translate-y-[8%] md:translate-y-[17%]">
          <Image
            src="/hero/moon.webp"
            alt=""
            width={2000}
            height={1117}
            priority
            quality={80}
            sizes="(max-width: 767px) 240vw, min(92vw, 1900px)"
            className="h-auto w-full select-none"
            draggable={false}
          />
          <div className="absolute top-[22%] left-1/2 h-[24%] w-[6%]">
            {MOTES.map((p, n) => (
              <span
                key={n}
                className="hero-mote absolute bottom-0 rounded-full bg-[#b9fbe9]"
                style={{
                  left: `calc(50% + ${p.x}vw)`,
                  width: p.s,
                  height: p.s,
                  animationDelay: `${p.d}s`,
                  animationDuration: `${p.dur}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Cloud banks: in front of the moon, part outward on scroll */}
      <div className="hero-par-cloud-l absolute bottom-0 left-0 w-[80vw] sm:w-[62vw] md:w-[min(48vw,940px)]">
        <div className="hero-cloud-in-l -translate-x-[38%] translate-y-[6%] sm:-translate-x-[20%] sm:translate-y-[24%] md:-translate-x-[12%] md:translate-y-[24%]">
          <Image
            src="/hero/clouds-left.webp"
            alt=""
            width={980}
            height={965}
            quality={78}
            sizes="(max-width: 767px) 80vw, 48vw"
            className="hero-cloud-mask-l h-auto w-full select-none"
            draggable={false}
          />
        </div>
      </div>
      <div className="hero-par-cloud-r absolute right-0 bottom-0 w-[80vw] sm:w-[62vw] md:w-[min(48vw,940px)]">
        <div className="hero-cloud-in-r translate-x-[38%] translate-y-[6%] sm:translate-x-[14%] sm:translate-y-[24%] md:translate-x-[6%] md:translate-y-[24%]">
          <Image
            src="/hero/clouds-right.webp"
            alt=""
            width={980}
            height={965}
            quality={78}
            sizes="(max-width: 767px) 80vw, 48vw"
            className="hero-cloud-mask-r h-auto w-full select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* Film grain + vignette, then a soft floor into the next (dark) section */}
      <div className="hero-grain absolute inset-0 opacity-[0.13] mix-blend-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_40%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[15%] min-h-28 md:h-[24%] md:min-h-40 bg-gradient-to-b from-transparent via-black/75 to-black" />
    </div>
  );
}
