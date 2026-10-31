import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroStage } from "./hero-stage";

const LINE_ONE = ["Don\u2019t", "just", "find", "information."];
const LINE_TWO = ["Find", "what\u2019s"];

export function Hero() {
  let i = 0;
  const word = (w: string) => (
    <span key={`${w}-${i}`} className="hero-word" style={{ animationDelay: `${0.35 + i++ * 0.07}s` }}>
      {w}
    </span>
  );

  return (
    <section
      data-header-dark
      aria-labelledby="hero-title"
      className="hero relative isolate flex h-[100svh] min-h-[640px] flex-col overflow-hidden bg-black text-white sm:min-h-[720px] lg:max-h-[1180px]"
    >
      <HeroStage />

      <div className="hero-copy relative z-20 mx-auto flex w-full max-w-5xl flex-col items-center px-5 pt-[clamp(6.5rem,15svh,10rem)] text-center sm:px-6">
        <Link
          href="/#how-it-works"
          className="hero-fade group inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] py-1 pr-3 pl-1 text-[13px] text-white/75 backdrop-blur-md transition-colors hover:border-white/25 hover:text-white"
          style={{ animationDelay: "0.15s" }}
        >
          <span className="rounded-full bg-white px-2 py-0.5 text-[11.5px] font-semibold text-black">New</span>
          <span>Shinchan Hackathon 2026</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>

        <h1
          id="hero-title"
          className="mt-7 text-[clamp(2.4rem,7.4vw,5.4rem)] leading-[1.02] font-medium tracking-[-0.045em] text-balance"
        >
          <span className="block">
            {LINE_ONE.map((w) => (
              <span key={w}>{word(w)} </span>
            ))}
          </span>
          <span className="block">
            {LINE_TWO.map((w) => (
              <span key={w}>{word(w)} </span>
            ))}
            <span className="hero-word hero-gradient-text" style={{ animationDelay: `${0.35 + i++ * 0.07}s` }}>
              missing.
            </span>
          </span>
        </h1>

        <p
          className="hero-fade mt-6 max-w-[34rem] text-[15.5px] leading-relaxed text-pretty text-[#a3a3b5] sm:text-[17px]"
          style={{ animationDelay: "1.05s" }}
        >
          GapLens reads every source and shows you the gaps, contradictions and stale facts before you trust them.
        </p>

        <div className="hero-fade mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "1.2s" }}>
          <Link
            href="/workspace"
            className="inline-flex h-11 items-center rounded-full border border-white/25 bg-black/20 px-6 text-[14.5px] font-medium text-white backdrop-blur-md transition-colors hover:border-white/50 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            Try it free
          </Link>
          <Link
            href="#example"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-6 text-[14.5px] font-medium text-black shadow-[0_0_40px_-8px_rgba(167,243,228,0.55)] transition-colors hover:bg-white/85 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
          >
            See an example
          </Link>
        </div>
      </div>
    </section>
  );
}
