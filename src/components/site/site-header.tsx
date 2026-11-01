"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/** Landing-page navigation, matching the hero reference. */
const LANDING_NAV = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#example", label: "Sources" },
  { href: "/history", label: "History" },
];

/** In-app navigation, unchanged from the existing product shell. */
const APP_NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#example", label: "Example" },
  { href: "/history", label: "History" },
];

/**
 * `overlay` is the floating landing-page bar: logo left, a white pill of links in the centre,
 * and a dark "Start researching" pill on the right. Without `overlay` the header is the regular
 * sticky light app bar.
 */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = overlay ? LANDING_NAV : APP_NAV;

  if (overlay) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 pt-4 sm:pt-6">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:rounded focus:bg-white focus:px-3 focus:py-1.5 focus:text-black focus:shadow"
        >
          Skip to content
        </a>

        <div className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-12 md:grid-cols-[1fr_auto_1fr]">
          <Logo tone="dark" variant="tile" />

          <nav
            aria-label="Primary"
            className="hidden items-center rounded-full border border-black/[0.06] bg-white/95 p-1.5 shadow-[0_18px_50px_-26px_rgba(0,0,0,0.75)] backdrop-blur-xl lg:flex"
          >
            {nav.map((item) => {
              const active = item.label === "Home";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-full px-6 py-2.5 text-[14.5px] font-medium transition-colors xl:px-8",
                    active ? "text-[#0a0a0c]" : "text-[#5c5c68] hover:bg-black/[0.045] hover:text-[#0a0a0c]",
                  )}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-0 bottom-1 flex justify-center gap-[2px]" aria-hidden="true">
                      <i className="size-[2px] rounded-full bg-[#0a0a0c]" />
                      <i className="size-[2px] rounded-full bg-[#0a0a0c]" />
                      <i className="size-[2px] rounded-full bg-[#0a0a0c]" />
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-2">
            <Link
              href="/workspace"
              className="inline-flex h-10 items-center rounded-full border border-white/10 bg-[#08080a]/90 px-4 text-[12.5px] font-medium text-white shadow-[0_14px_34px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-black sm:h-12 sm:px-6 sm:text-[14px]"
            >
              Start researching
            </Link>
            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex size-11 items-center justify-center rounded-full border border-black/[0.06] bg-white/95 text-[#0a0a0c] shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl lg:hidden"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="absolute inset-x-4 top-[calc(100%+0.5rem)] rounded-3xl border border-black/[0.06] bg-white/95 p-3 text-[#0a0a0c] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-2xl lg:hidden">
            <nav aria-label="Mobile primary" className="flex flex-col">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl px-4 py-3 text-[15px] font-medium text-[#3f3f49] transition-colors hover:bg-black/[0.045] hover:text-[#0a0a0c]"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/workspace"
                onClick={() => setMobileOpen(false)}
                className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-[#08080a] px-5 text-sm font-semibold text-white"
              >
                Start researching
              </Link>
            </nav>
          </div>
        )}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 text-foreground backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:rounded focus:bg-card focus:px-3 focus:py-1.5 focus:text-foreground focus:shadow"
      >
        Skip to content
      </a>
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <Logo tone="light" />
        <nav aria-label="Primary" className="hidden items-center gap-1 text-[13px] md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/workspace"
            className="hidden h-9 items-center rounded-full border border-border bg-card px-4 text-[13.5px] font-medium transition-colors hover:border-brand/40 hover:bg-brand-soft sm:inline-flex"
          >
            Explore workspace
          </Link>
          <Link
            href="/workspace"
            className="inline-flex h-9 items-center rounded-full bg-[#202322] px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-[#2f3431]"
          >
            Start researching
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-foreground md:hidden"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="absolute inset-x-3 top-full min-h-[calc(100svh-5rem)] rounded-3xl border-t border-border bg-background/95 p-5 text-foreground backdrop-blur-2xl md:hidden">
          <nav aria-label="Mobile primary" className="flex flex-col gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-base text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/workspace"
              onClick={() => setMobileOpen(false)}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Start researching
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
