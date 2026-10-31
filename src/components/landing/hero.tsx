import Link from "next/link";
import { ArrowRight, Layers3, Network, Users, Zap } from "lucide-react";
import { HeroStage } from "./hero-stage";

const METRICS = [
  { icon: Layers3, value: "8K+", label: "Sources analysed" },
  { icon: Zap, value: "99.9%", label: "Extraction accuracy" },
  { icon: Network, value: "4x", label: "Faster literature review" },
  { icon: Users, value: "2K+", label: "Researchers & students" },
];

export function Hero() {
  return (
    <section
      data-header-dark
      aria-labelledby="hero-title"
      className="hero relative isolate flex min-h-[760px] flex-col overflow-hidden bg-[#050509] text-white sm:min-h-[850px] lg:min-h-[900px] lg:h-[100svh]"
    >
      <HeroStage />

      <div className="hero-copy relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-5 pb-10 pt-[clamp(7.5rem,15vh,10rem)] text-center sm:px-8 lg:pt-[clamp(8.5rem,17vh,11rem)]">
        <div className="hero-fade inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#15121d]/75 px-4 py-2 text-[11px] font-medium tracking-[0.04em] text-white/70 shadow-[0_12px_30px_-20px_rgba(182,111,255,0.8)] backdrop-blur-xl sm:text-xs">
          <span className="size-1.5 rounded-full bg-[#d68dff] shadow-[0_0_12px_#d68dff]" />
          AI-powered evidence intelligence
        </div>

        <h1
          id="hero-title"
          className="hero-fade mt-7 max-w-[1200px] font-mono text-[clamp(2.4rem,6.2vw,5.5rem)] leading-[0.98] font-bold tracking-[-0.09em] text-balance sm:mt-8"
          style={{ animationDelay: "0.12s" }}
        >
          <span className="block text-white">Turn scattered research</span>
          <span className="hero-pixel-accent block">into a clear evidence map.</span>
        </h1>

        <p
          className="hero-fade mt-6 max-w-[620px] text-[14px] leading-7 text-white/55 sm:mt-7 sm:text-[16px]"
          style={{ animationDelay: "0.24s" }}
        >
          Search papers, extract trustworthy claims, and connect the evidence
          <br className="hidden sm:block" /> in one focused workspace.
        </p>

        <Link
          href="/workspace"
          className="hero-fade mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#16121d] shadow-[0_16px_50px_-18px_rgba(255,255,255,0.75)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050509] sm:mt-9"
          style={{ animationDelay: "0.36s" }}
        >
          Start researching <ArrowRight className="size-4" />
        </Link>

        <div className="hero-metrics hero-fade mt-auto grid w-full max-w-5xl grid-cols-2 border-t border-white/10 pt-7 sm:mt-20 sm:grid-cols-4 sm:pt-8" style={{ animationDelay: "0.5s" }}>
          {METRICS.map(({ icon: Icon, value, label }, index) => (
            <div key={label} className={`flex items-center gap-3 px-3 py-2 text-left sm:px-5 ${index > 0 ? "border-l border-white/10" : ""}`}>
              <Icon className="size-4 shrink-0 text-[#d08bff]" strokeWidth={1.7} aria-hidden="true" />
              <div>
                <p className="font-mono text-lg font-semibold tracking-[-0.04em] text-white sm:text-xl">{value}</p>
                <p className="mt-0.5 text-[10px] leading-4 text-white/40 sm:text-[11px]">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
