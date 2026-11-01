import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "dark" | "light";
type Variant = "mark" | "tile" | "spark";

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

  // Editorial sparkle used by the app navigation: a single ink-black four-point star.
  if (variant === "spark") {
    return (
      <span className={cn("inline-flex size-5 shrink-0 items-center justify-center", dark ? "text-white" : "text-[#202322]", className)}>
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M12 1.6c.62 5.5 1.72 7.7 4.1 8.8 1.5.7 3.1 1.05 5.3 1.4-2.2.35-3.8.7-5.3 1.4-2.38 1.1-3.48 3.3-4.1 8.8-.62-5.5-1.72-7.7-4.1-8.8-1.5-.7-3.1-1.05-5.3-1.4 2.2-.35 3.8-.7 5.3-1.4 2.38-1.1 3.48-3.3 4.1-8.8Z" />
        </svg>
      </span>
    );
  }

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
          <stop offset="0" stopColor={dark ? "#8b5cf6" : "#202322"} />
          <stop offset="0.5" stopColor={dark ? "#7c8cf8" : "#46514b"} />
          <stop offset="1" stopColor={dark ? "#67e8d6" : "#8b9a83"} />
        </linearGradient>
        <radialGradient id={`${id}h`} cx="23.42" cy="8.58" r="6.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={dark ? "#5eead4" : "#8b9a83"} stopOpacity={dark ? 0.55 : 0.35} />
          <stop offset="1" stopColor={dark ? "#5eead4" : "#8b9a83"} stopOpacity="0" />
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
      <circle cx="23.42" cy="8.58" r="2.5" fill={dark ? "#a7f3e4" : "#7d8f74"} />
      <circle cx="22.9" cy="8.1" r="0.9" fill={dark ? "#f0fdfa" : "#eaf0e6"} />
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
  const spark = variant === "spark";
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="GapLens home"
    >
      <LogoMark
        tone={tone}
        variant={variant}
        className={cn(
          "transition-transform duration-500",
          tile ? "group-hover:scale-[1.04]" : spark ? "group-hover:rotate-[90deg]" : "group-hover:rotate-[24deg]",
        )}
      />
      <span
        className={cn(
          "tracking-[-0.01em]",
          tile ? "text-[20px] font-semibold text-white" : spark ? "font-display text-[20px] font-medium text-[#202322]" : "font-display text-[19px] font-medium",
        )}
      >
        Gap<span className={cn(tile ? "font-normal text-white" : spark ? "font-normal" : "font-normal")}>Lens</span>
      </span>
    </Link>
  );
}
