import Link from "next/link";
import { ArrowRight, Layers, Network, Sparkles, Users, Zap } from "lucide-react";
import { HeroStage } from "./hero-stage";

/**
 * Marketing metrics shown in the hero.
 *
 * These are illustrative placeholders only. Replace them with measured analytics
 * (or remove them) before they can be presented as verified product performance.
 * Keeping them in one config makes that swap trivial.
 */
const HERO_METRICS = [
  { icon: Layers, value: "8K+", label: "Sources analysed" },
  { icon: Zap, value: "99.9%", label: "Extraction accuracy" },
  { icon: Network, value: "4x", label: "Faster literature review" },
  { icon: Users, value: "2K+", label: "Researchers & students" },
];

export function Hero() {
  return (
    <section
      data-header-dark
      aria-labelledby="hero-title"
      className="hero relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#040407] text-white"
    >
      <HeroStage />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-5 pt-32 text-center sm:px-8 sm:pt-[clamp(8.5rem,24.5vh,15.5rem)]">
        <div className="hero-fade inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#0d0b12]/70 py-2.5 pl-3 pr-8 backdrop-blur-xl">
          <span className="flex size-10 items-center justify-center rounded-full bg-white/10">
            <Sparkles className="size-[18px] text-white" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-medium text-white/90">AI-powered evidence intelligence</span>
        </div>

        <h1
          id="hero-title"
          className="hero-fade mt-2 max-w-[1120px] font-pixel text-[clamp(1.5rem,5.4vw,4.85rem)] leading-[1.06] font-bold tracking-[-0.015em]"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="block text-white">Turn scattered research</span>
          <span className="block">
            into a clear <span className="hero-pixel-accent whitespace-nowrap">evidence map.</span>
          </span>
        </h1>

        <p
          className="hero-fade mt-4 max-w-[800px] text-[15px] leading-[1.8] text-white/78 sm:mt-4 sm:text-[17.5px] sm:leading-[1.95]"
          style={{ animationDelay: "0.2s" }}
        >
          Search papers, extract trustworthy claims, and connect the evidence
          <br className="hidden sm:block" /> in one focused workspace.
        </p>

        <Link
          href="/workspace"
          className="hero-fade group mt-6 inline-flex h-14 items-center gap-2.5 rounded-full bg-white px-9 text-[16px] sm:px-12 sm:text-[17px] font-semibold text-[#0a0a0c] shadow-[0_16px_40px_-26px_rgba(255,255,255,0.35)] transition-transform duration-300 hover:-translate-y-0.5 hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040407] sm:mt-10"
          style={{ animationDelay: "0.3s" }}
        >
          Start researching
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="relative z-10 mt-auto w-full px-5 pb-10 sm:px-8 sm:pb-[6.5rem]">
        {/* Keeps the metrics legible where the wave passes behind them on small screens. */}
        <div
          className="pointer-events-none absolute inset-x-0 -top-14 bottom-0 bg-gradient-to-t from-[#040407] via-[#040407]/88 to-transparent sm:hidden"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid w-full max-w-[1180px] grid-cols-2 gap-y-7 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-white/12">
          {HERO_METRICS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center gap-2.5 px-2 text-center sm:px-3 lg:px-8">
              <Icon className="size-7 text-white/85" strokeWidth={1.6} aria-hidden="true" />
              <p className="text-[30px] font-semibold tracking-[-0.02em] text-white sm:text-[36px]">{value}</p>
              <p className="text-[13px] text-white/65 sm:text-[15px]">{label}</p>
            </div>
          ))}
        </div>
        <p className="sr-only">Illustrative marketing metrics, not verified product analytics.</p>
      </div>
    </section>
  );
}
