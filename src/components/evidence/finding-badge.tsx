import { cn } from "@/lib/utils";
import { FINDING_LABELS, type FindingKind } from "./finding-labels";

export function FindingBadge({
  kind,
  label,
  className,
  showIcon = true,
}: {
  kind: FindingKind;
  /** Override the default label text. */
  label?: string;
  className?: string;
  showIcon?: boolean;
}) {
  const meta = FINDING_LABELS[kind];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.className,
        className,
      )}
      title={meta.description}
    >
      {showIcon && <Icon className="size-3.5" aria-hidden="true" />}
      {label ?? meta.label}
    </span>
  );
}
