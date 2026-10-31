import { FindingBadge } from "@/components/evidence/finding-badge";
import { FindingLegend } from "@/components/evidence/finding-legend";
import { SectionHeading } from "./section";

/**
 * Illustrative example ONLY. Hard-coded copy for the landing page, clearly labelled as such.
 * It is not output from the GapLens pipeline and cites no real source.
 */
export function ExampleAnalysis() {
  return (
    <section id="example" aria-labelledby="example-title" className="border-b border-border/70 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading
          id="example-title"
          eyebrow="Example analysis"
          title="What a GapLens finding looks like."
          description="An illustrative example of the output format. The sources and quotes below are invented for demonstration and are not real analysis results."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <article className="overflow-hidden rounded-xl border bg-card shadow-xs" aria-label="Illustrative example analysis">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-6 py-4">
              <div>
                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Research question</p>
                <p className="mt-1 font-medium">When is the scholarship application deadline, and can it be renewed?</p>
              </div>
              <span className="rounded-full border border-dashed px-2.5 py-0.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                Illustrative example
              </span>
            </header>

            <div className="divide-y">
              <div className="space-y-4 px-6 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <FindingBadge kind="contradiction" />
                  <span className="text-xs text-muted-foreground">Severity: high</span>
                </div>
                <h3 className="font-medium">Application deadline differs between sources</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <blockquote className="rounded-lg border-l-2 border-red-400 bg-red-50/50 px-4 py-3 text-sm">
                    <p className="font-serif text-[15px] italic">&ldquo;Applications close on 15 November.&rdquo;</p>
                    <footer className="mt-2 font-mono text-[11px] text-muted-foreground">Source A · programme page</footer>
                  </blockquote>
                  <blockquote className="rounded-lg border-l-2 border-red-400 bg-red-50/50 px-4 py-3 text-sm">
                    <p className="font-serif text-[15px] italic">&ldquo;The last date to apply is 30 November.&rdquo;</p>
                    <footer className="mt-2 font-mono text-[11px] text-muted-foreground">Source B · handbook PDF</footer>
                  </blockquote>
                </div>
                <p className="text-sm text-muted-foreground">
                  Neither source says it supersedes the other. Treat <strong className="font-medium text-foreground">15 November</strong> as the safe date until it&apos;s confirmed.
                </p>
              </div>

              <div className="space-y-3 px-6 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <FindingBadge kind="gap" />
                  <FindingBadge kind="not_found" />
                </div>
                <h3 className="font-medium">Renewal conditions are not stated</h3>
                <p className="text-sm text-muted-foreground">
                  Both sources mention that the award &ldquo;may be renewed&rdquo;, but neither states the GPA, attendance or
                  reapplication requirements. Not found in the reviewed sources, which doesn&apos;t mean they don&apos;t exist.
                </p>
              </div>

              <div className="space-y-3 px-6 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <FindingBadge kind="outdated" />
                </div>
                <h3 className="font-medium">Handbook refers to the 2025 cycle</h3>
                <blockquote className="rounded-lg border-l-2 border-amber-400 bg-amber-50/50 px-4 py-3 text-sm">
                  <p className="font-serif text-[15px] italic">&ldquo;For the 2025 admission cycle, the following dates apply…&rdquo;</p>
                  <footer className="mt-2 font-mono text-[11px] text-muted-foreground">Source B · handbook PDF</footer>
                </blockquote>
              </div>

              <div className="space-y-3 bg-muted/30 px-6 py-5">
                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Verification checklist</p>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-800 uppercase">High</span>
                    <span>Confirm the current-cycle deadline directly with the scholarship office.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800 uppercase">Med</span>
                    <span>Request the written renewal criteria before accepting the award.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0"><FindingBadge kind="ai_suggestion" showIcon={false} className="py-0 text-[10px]" /></span>
                    <span>Check whether an updated handbook has been published for the current cycle.</span>
                  </li>
                </ul>
              </div>
            </div>
          </article>

          <aside aria-labelledby="legend-title" className="rounded-xl border bg-card p-6">
            <h3 id="legend-title" className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Label legend</h3>
            <FindingLegend className="mt-5 sm:grid-cols-1" />
          </aside>
        </div>
      </div>
    </section>
  );
}
