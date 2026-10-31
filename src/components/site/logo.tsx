import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 10.5h2M11.5 10.5h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="0" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)} aria-label="GapLens home">
      <LogoMark className="text-brand" />
      <span className="text-[17px]">GapLens</span>
    </Link>
  );
}
