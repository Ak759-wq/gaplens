import { SectionHeading } from "./section";

const POINTS = [
  {
    stat: "Silent omissions",
    body: "A page can be accurate and still leave out the one condition that decides whether you qualify. Summaries hide this; they compress what is there and say nothing about what is not.",
  },
  {
    stat: "Quiet conflicts",
    body: "Two official-looking sources give different deadlines, fees or rules. Unless you read both side by side, you'll probably trust whichever one you opened first.",
  },
  {
    stat: "Stale certainty",
    body: "Old pages keep ranking long after a policy changes. A confident answer from last year's cycle looks exactly like a current one.",
  },
];

export function Problem() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="border-b border-border/70">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading
          id="problem-title"
          eyebrow="The information-gap problem"
          title="Search gives you answers. It rarely tells you what's missing."
          description="Most research tools find and summarise. The costly mistakes come from what no source mentions, what sources disagree on, and what quietly went out of date."
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.stat} className="bg-card p-7">
              <h3 className="font-serif text-xl tracking-tight">{p.stat}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
