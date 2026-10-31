"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { HeroFallback } from "./hero-fallback";

// three.js + R3F live only in this lazily loaded chunk, fetched on the landing page once the hero is visible.
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false, loading: () => null });

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatch(mq.matches);
    const on = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export function HeroVisual({ className }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const compact = !useMedia("(min-width: 1024px)");

  useEffect(() => setWebgl(supportsWebGL()), []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Track the pointer across the whole hero section for parallax and the lens follow.
  useEffect(() => {
    const section = wrap.current?.closest("section");
    if (!section || reducedMotion) return;
    const onMove = (e: PointerEvent) => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      const x = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 1;
      const y = -((e.clientY - (r.top + r.height / 2)) / (r.height / 2));
      pointer.current = { x: Math.max(-1.2, Math.min(1.2, x)), y: Math.max(-1.2, Math.min(1.2, y)) };
    };
    const onLeave = () => (pointer.current = { x: 0, y: 0 });
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    return () => {
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    };
  }, [reducedMotion]);

  const use3d = webgl === true && !failed;
  // Mount once first seen; afterwards keep the context alive and just pause the frame loop.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (use3d && inView) setMounted(true);
  }, [use3d, inView]);

  return (
    <div ref={wrap} className={cn("relative", className)} aria-hidden="true">
      <HeroFallback className={cn("transition-opacity duration-700", ready && use3d ? "opacity-0" : "opacity-100")} />
      {use3d && mounted && (
        <div className={cn("absolute inset-0 transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")}>
          <SceneBoundary onError={() => setFailed(true)}>
            <HeroScene
              active={inView}
              reducedMotion={reducedMotion}
              compact={compact}
              pointer={pointer}
              onReady={() => setReady(true)}
            />
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}
