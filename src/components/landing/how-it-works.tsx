import { FileSearch, GitCompareArrows, ListChecks, Quote, ScanSearch } from "lucide-react";
import { SectionHeading } from "./section";

const STEPS = [
  { icon: FileSearch, title: "Collect sources", body: "Add URLs and PDFs alongside a research question and what you're trying to decide." },
  { icon: Quote, title: "Extract claims", body: "Each source is broken into atomic claims, every one tied to a verbatim quote and categorised." },
  { icon: GitCompareArrows, title: "Cross-examine", body: "Claims are compared across sources to find contradictions, coverage gaps and dated information." },
  { icon: ScanSearch, title: "Verify citations", body: "Quotes are checked against the stored source text. Anything that can't be found is dropped." },
  { icon: ListChecks, title: "Act on it", body: "You get open questions and a prioritised checklist of what to confirm, and with whom." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="border-b border-border/70 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="A pipeline built around evidence."
          description="Each stage has a narrow job and a typed output. The model never gets to state something without pointing to where it came from."
        />
        <ol className="mt-14 grid gap-4 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <s.icon className="size-5 text-brand" aria-hidden="true" />
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
