import { ClosingCta } from "@/components/landing/cta";
import { ExampleAnalysis } from "@/components/landing/example-analysis";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Problem } from "@/components/landing/problem";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Problem />
      {/* The light content sheet slides up over the dark opening. */}
      <div className="relative z-10 -mt-10 overflow-hidden rounded-t-[2rem] bg-background shadow-[0_-30px_80px_-20px_rgba(124,92,246,0.25)] sm:rounded-t-[2.5rem]">
        <HowItWorks />
        <Features />
        <ExampleAnalysis />
        <ClosingCta />
      </div>
    </>
  );
}
