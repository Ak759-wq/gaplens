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
      <HowItWorks />
      <Features />
      <ExampleAnalysis />
      <ClosingCta />
    </>
  );
}
