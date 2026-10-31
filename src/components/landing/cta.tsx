import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border bg-primary px-8 py-14 text-primary-foreground sm:px-14">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[radial-gradient(closest-side,oklch(0.55_0.15_268/0.55),transparent)]" aria-hidden="true" />
          <h2 id="cta-title" className="relative max-w-xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            Know what your sources don&apos;t tell you before you rely on them.
          </h2>
          <Button asChild size="lg" variant="secondary" className="relative mt-8">
            <Link href="/workspace">
              Start research <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
