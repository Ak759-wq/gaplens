import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "dark" | "light";
type Variant = "mark" | "tile";

/**
 * GapLens mark: a lens ring with a precise missing arc, and the found piece glowing in the gap.
 * `tone="dark"` is for dark surfaces (luminous mint), `tone="light"` for light ones (deeper teal/violet).
 * `variant="tile"` renders the app-icon treatment used by the landing-page navigation.
 */
export function LogoMark({
  className,
  tone = "light",
  variant = "mark",
}: {
  className?: string;
  tone?: Tone;
  variant?: Variant;
}) {
  const id = useId().replace(/:/g, "");
  const dark = tone === "dark";

  if (variant === "tile") {
    return (
      <span
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#c084fc] via-[#8b5cf6] to-[#6d28d9] shadow-[0_0_28px_-6px_rgba(168,85,247,0.9)]",
          className,
        )}
      >
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" focusable="false">
          <circle
            cx="12"
            cy="12"
            r="7.4"
            fill="none"
            stroke="white"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray="36 10.5"
            strokeDashoffset="5"
          />
          <circle cx="18.4" cy="6.2" r="2" fill="white" />
        </svg>
      </span>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}r`} x1="7" y1="27" x2="26" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={dark ? "#8b5cf6" : "#6d28d9"} />
          <stop offset="0.5" stopColor={dark ? "#7c8cf8" : "#4f46e5"} />
          <stop offset="1" stopColor={dark ? "#67e8d6" : "#0d9488"} />
        </linearGradient>
        <radialGradient id={`${id}h`} cx="23.42" cy="8.58" r="6.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={dark ? "#5eead4" : "#2dd4bf"} stopOpacity={dark ? 0.55 : 0.4} />
          <stop offset="1" stopColor={dark ? "#5eead4" : "#2dd4bf"} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M26.34 14.18A10.5 10.5 0 1 1 17.82 5.66"
        fill="none"
        stroke={`url(#${id}r)`}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="23.42" cy="8.58" r="6.5" fill={`url(#${id}h)`} />
      <circle cx="23.42" cy="8.58" r="2.5" fill={dark ? "#a7f3e4" : "#14b8a6"} />
      <circle cx="22.9" cy="8.1" r="0.9" fill={dark ? "#f0fdfa" : "#ccfbf1"} />
    </svg>
  );
}

export function Logo({
  className,
  tone = "light",
  variant = "mark",
}: {
  className?: string;
  tone?: Tone;
  variant?: Variant;
}) {
  const tile = variant === "tile";
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="GapLens home"
    >
      <LogoMark
        tone={tone}
        variant={variant}
        className={cn("transition-transform duration-500", tile ? "group-hover:scale-[1.04]" : "group-hover:rotate-[24deg]")}
      />
      <span className={cn("font-semibold tracking-[-0.03em]", tile ? "text-[20px] text-white" : "text-[17px]")}>
        Gap
        <span className={cn("font-normal", tile ? "text-white" : tone === "dark" ? "text-white/80" : "text-foreground/75")}>
          Lens
        </span>
      </span>
    </Link>
  );
}
