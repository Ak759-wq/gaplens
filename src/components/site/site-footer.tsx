import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="relative z-20 border-t border-[#e3e3de] bg-[#faf9f6]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Don&apos;t just find information. Find what&apos;s missing. Built for the Shinchan Online Hackathon 2026.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Product</h2>
          <ul className="space-y-2 text-sm">
            <li><Link href="/workspace" className="hover:text-brand">Research workspace</Link></li>
            <li><Link href="/history" className="hover:text-brand">History</Link></li>
            <li><Link href="/#features" className="hover:text-brand">Features</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Principles</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Every claim links to a quote</li>
            <li>Missing ≠ nonexistent</li>
            <li>Undated ≠ outdated</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} GapLens. AI findings are leads for verification, not final answers.
        </p>
      </div>
    </footer>
  );
}
