import { CircleDashed, Clock, GitCompareArrows, HelpCircle, ListChecks, Quote } from "lucide-react";
import { SectionHeading } from "./section";

const FEATURES = [
  { icon: CircleDashed, tone: "text-orange-600", title: "Information gaps", body: "What your question needs that none of the reviewed sources state, phrased as 'not found in the reviewed sources' rather than 'doesn't exist'." },
  { icon: GitCompareArrows, tone: "text-red-600", title: "Contradictions", body: "Side-by-side positions from different sources, each with its quote. GapLens shows the conflict and doesn't pick a winner." },
  { icon: Clock, tone: "text-amber-600", title: "Freshness warnings", body: "Flags sources tied to past cycles or old dates, and marks undated sources as undated rather than outdated." },
  { icon: HelpCircle, tone: "text-sky-600", title: "Unanswered questions", body: "Concrete questions the sources leave open, each linked to the findings that raised it." },
  { icon: ListChecks, tone: "text-slate-700", title: "Verification checklist", body: "A prioritised list of what to confirm before you rely on the answer, with the reason for each item." },
  { icon: Quote, tone: "text-emerald-600", title: "Evidence on every finding", body: "Every item traces to a source and an exact quote, checked against the text that was actually retrieved." },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="border-b border-border/70">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading
          id="features-title"
          eyebrow="What you get"
          title="An audit of your sources, not a summary of them."
        />
        <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <div className="flex size-10 items-center justify-center rounded-lg border bg-card">
                <f.icon className={`size-5 ${f.tone}`} aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
