import { cn } from "@/lib/utils";
import { FindingBadge } from "./finding-badge";
import { FINDING_KINDS, FINDING_LABELS } from "./finding-labels";

export function FindingLegend({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Finding label legend">
        {FINDING_KINDS.map((k) => (
          <li key={k}>
            <FindingBadge kind={k} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {FINDING_KINDS.map((k) => (
        <div key={k} className="flex flex-col gap-1.5">
          <dt>
            <FindingBadge kind={k} />
          </dt>
          <dd className="text-muted-foreground text-xs leading-relaxed">{FINDING_LABELS[k].description}</dd>
        </div>
      ))}
    </dl>
  );
}
