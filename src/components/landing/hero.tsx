import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroVisual } from "./hero-visual";

const LEGEND = [
  { label: "Source-backed", dot: "bg-emerald-400" },
  { label: "Gap", dot: "bg-orange-400" },
  { label: "Contradiction", dot: "bg-red-400" },
  { label: "Outdated", dot: "bg-amber-400" },
  { label: "AI suggestion", dot: "bg-violet-400" },
];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex flex-col overflow-hidden border-b lg:block border-white/10 bg-[#070b17] text-slate-100"
    >
      {/* Background: ink gradient, faint grid, radial glows, grain */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_75%_40%,#121a3a_0%,#0a0f22_45%,#070b17_80%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,#c7d2fe_1px,transparent_1px),linear-gradient(to_bottom,#c7d2fe_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_70%_at_70%_45%,black,transparent)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/2 right-[-10%] -z-10 h-[620px] w-[760px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.28),rgba(139,92,246,0.08)_60%,transparent)] blur-2xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-40 -left-40 -z-10 h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(56,189,248,0.10),transparent)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')]"
        aria-hidden="true"
      />

      {/* 3D scene: full right half on desktop, below the copy on small screens */}
      <HeroVisual className="order-last h-[380px] w-full sm:h-[440px] lg:absolute lg:inset-y-0 lg:right-0 lg:left-[50%] lg:h-auto lg:w-auto xl:left-[47%]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6 lg:pointer-events-none lg:flex lg:min-h-[680px] lg:items-center lg:pt-0 lg:pb-0">
        <div className="pointer-events-auto max-w-[560px] lg:max-w-[520px] xl:max-w-[560px]">
          <p className="mb-7 inline-flex max-w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 font-mono text-[10.5px] tracking-[0.12em] text-slate-300 uppercase backdrop-blur sm:text-[11px]">
            <span className="size-1.5 shrink-0 rounded-full bg-indigo-300 shadow-[0_0_10px_2px_rgba(165,180,252,0.6)]" aria-hidden="true" />
            <span className="truncate">Shinchan Online Hackathon 2026 · Digital Dark Spots</span>
          </p>
          <h1
            id="hero-title"
            className="font-serif text-[2.6rem] leading-[1.04] tracking-[-0.02em] text-balance text-white sm:text-6xl lg:text-[4.1rem]"
          >
            Don&apos;t just find information. Find what&apos;s{" "}
            <em className="bg-gradient-to-r from-indigo-200 via-violet-200 to-orange-200 bg-clip-text pr-1 text-transparent italic">
              missing
            </em>
            .
          </h1>
          <p className="mt-6 max-w-[480px] text-[17px] leading-relaxed text-pretty text-slate-300">
            GapLens reads your sources side by side and shows the gaps, contradictions and out-of-date claims, each
            linked to a quote you can check.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="bg-white text-[#0b1124] shadow-[0_8px_30px_-8px_rgba(165,180,252,0.6)] hover:bg-indigo-50">
              <Link href="/workspace">
                Start research <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="border border-white/15 text-slate-100 hover:bg-white/[0.06] hover:text-white"
            >
              <Link href="#example">
                See an example <ArrowDown />
              </Link>
            </Button>
          </div>
          <ul className="mt-10 flex flex-wrap gap-2" aria-label="Finding colour legend">
            {LEGEND.map((l) => (
              <li
                key={l.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300"
              >
                <span className={`size-1.5 rounded-full ${l.dot}`} aria-hidden="true" />
                {l.label}
              </li>
            ))}
          </ul>
          <p className="mt-4 hidden text-[11px] text-slate-400 lg:block">Illustrative scene · drag to rotate, hover a source</p>
        </div>
      </div>
    </section>
  );
}
