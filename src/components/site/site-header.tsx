"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#example", label: "Example" },
  { href: "/history", label: "History" },
];

/**
 * `overlay` (landing page): fixed and transparent over the dark hero, switching to the light frosted bar
 * once a light section sits under it. Elsewhere the header is the regular sticky light bar.
 */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [dark, setDark] = useState(overlay);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const probe = 30;
      let overDark = false;
      document.querySelectorAll<HTMLElement>("[data-header-dark]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) overDark = true;
      });
      setDark(overDark);
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [overlay]);

  return (
    <header
      className={cn(
        "top-0 z-40 transition-[background-color,border-color,color] duration-500",
        overlay ? "fixed inset-x-0" : "sticky",
        dark
          ? cn("border-b text-white", scrolled ? "border-white/[0.06] bg-black/45 backdrop-blur-xl" : "border-transparent bg-transparent")
          : "border-b border-border/70 bg-background/80 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/70",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:rounded focus:bg-card focus:px-3 focus:py-1.5 focus:text-foreground focus:shadow"
      >
        Skip to content
      </a>
      <div className={cn("mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]", overlay ? "h-16" : "h-14")}>
        <Logo tone={dark ? "dark" : "light"} />
        <nav aria-label="Primary" className="hidden items-center gap-1 text-[14px] md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors",
                dark ? "text-white/65 hover:bg-white/[0.06] hover:text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
              dark ? "border-white/20 text-white hover:border-white/40 hover:bg-white/[0.06]" : "border-border bg-card hover:bg-accent",
            )}
          >
            Open workspace
          </Link>
          <Link
            href="/workspace"
            className={cn(
              "inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-medium transition-colors",
              dark ? "bg-white text-black hover:bg-white/85" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            Start research
          </Link>
        </div>
      </div>
    </header>
  );
}
