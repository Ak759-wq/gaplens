"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Sources" },
  { href: "/history", label: "History" },
];

/**
 * The header keeps one translucent light treatment across marketing and app surfaces.
 */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      className={cn(
        "top-0 z-40 text-foreground",
        overlay
          ? "fixed inset-x-0 border-0 bg-transparent px-3 pt-4 sm:px-6 sm:pt-5"
          : "sticky border-b border-border/80 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:rounded focus:bg-card focus:px-3 focus:py-1.5 focus:text-foreground focus:shadow"
      >
        Skip to content
      </a>
      <div className={cn("mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]", overlay ? "h-14 rounded-full border border-white/10 bg-[#0d0b14]/70 px-4 text-white shadow-[0_20px_60px_-32px_rgba(177,96,255,.8)] backdrop-blur-2xl sm:h-16 sm:px-6" : "h-14")}>
        <Logo tone={overlay ? "dark" : "light"} />
        <nav aria-label="Primary" className="hidden items-center gap-1 text-[13px] md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors",
                overlay
                  ? n.label === "Home"
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/10 hover:text-white"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/workspace"
            className={cn(
              "hidden h-9 items-center rounded-full border px-4 text-[13.5px] font-medium transition-colors sm:inline-flex",
              overlay
                ? "border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/10"
                : "border-border bg-card hover:border-brand/40 hover:bg-brand-soft",
            )}
          >
            Explore workspace
          </Link>
          <Link
            href="/workspace"
            className={cn(
              "inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-medium transition-colors",
              overlay ? "bg-white text-[#17131f] hover:bg-white/90" : "bg-[#202322] text-white hover:bg-[#2f3431]",
            )}
          >
            Start researching
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className={cn("inline-flex size-9 items-center justify-center rounded-lg md:hidden", overlay ? "border-white/20 text-white" : "border-border text-foreground")}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className={cn("absolute inset-x-3 top-full min-h-[calc(100svh-5rem)] rounded-3xl p-5 backdrop-blur-2xl md:hidden", overlay ? "border border-white/10 bg-[#0d0b14]/95 text-white" : "border-t border-border bg-background/95 text-foreground")}>
          <nav aria-label="Mobile primary" className="flex flex-col gap-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMobileOpen(false)} className={cn("rounded-xl px-4 py-3 text-base", overlay ? "text-white/65 hover:bg-white/10 hover:text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                {n.label}
              </Link>
            ))}
            <Link href="/workspace" onClick={() => setMobileOpen(false)} className={cn("mt-4 inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold", overlay ? "bg-white text-[#17131f]" : "bg-primary text-primary-foreground")}>
              Start researching
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
