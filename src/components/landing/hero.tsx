import Link from "next/link";
import { ArrowRight, FileText, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FindingBadge } from "@/components/evidence/finding-badge";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-border/70">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.9_0.05_268/0.55),transparent)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 pt-20 pb-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-28 lg:pb-28">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
            Information gap detection
          </p>
          <h1 id="hero-title" className="font-serif text-[2.75rem] leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Don&apos;t just find information.{" "}
            <em className="text-brand not-italic sm:italic">Find what&apos;s missing.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            GapLens reads your sources against a research question and shows what they leave out: missing
            details, conflicts between sources, out-of-date information and the questions nobody answered.
            Every finding links back to a quote you can check.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/workspace">
                Start research <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="#example">See an example analysis</Link>
            </Button>
          </div>
        </div>

        <div aria-hidden="true" className="relative">
          <div className="rounded-xl border bg-card p-5 shadow-[0_1px_0_0_oklch(0_0_0/0.03),0_24px_48px_-24px_oklch(0.3_0.05_268/0.25)]">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Sources under review</span>
              <span className="font-mono text-[11px] text-muted-foreground">3 inputs</span>
            </div>
            <ul className="divide-y text-sm">
              {[
                { icon: Globe, name: "Official programme page", kind: "URL" },
                { icon: FileText, name: "Guidelines handbook.pdf", kind: "PDF" },
                { icon: Globe, name: "University notice board", kind: "URL" },
              ].map((s) => (
                <li key={s.name} className="flex items-center gap-3 py-3">
                  <s.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{s.kind}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2 border-t pt-4">
              <FindingBadge kind="contradiction" />
              <FindingBadge kind="gap" />
              <FindingBadge kind="outdated" />
              <FindingBadge kind="verified" />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Illustrative layout</p>
        </div>
      </div>
    </section>
  );
}
