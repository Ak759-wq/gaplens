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

/** Dark continuation of the hero, so the cinematic opening hands off gracefully before the light sheet. */
export function Problem() {
  return (
    <section id="problem" data-header-dark aria-labelledby="problem-title" className="relative bg-black text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(94,234,212,0.07),transparent_70%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-32 sm:px-6 sm:pt-24 sm:pb-40">
        <div className="max-w-2xl">
          <p className="mb-3 font-mono text-xs tracking-[0.14em] text-[#8ef0de] uppercase">The information-gap problem</p>
          <h2 id="problem-title" className="font-serif text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
            Search gives you answers. It rarely tells you what&apos;s missing.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-pretty text-white/60">
            Most research tools find and summarise. The costly mistakes come from what no source mentions, what sources
            disagree on, and what quietly went out of date.
          </p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.stat} className="bg-[#07060d] p-7">
              <h3 className="font-serif text-xl tracking-tight">{p.stat}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
