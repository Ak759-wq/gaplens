import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  id,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="mb-3 font-mono text-xs tracking-[0.14em] text-brand uppercase">{eyebrow}</p>
      <h2 id={id} className="font-serif text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {description && <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">{description}</p>}
    </div>
  );
}
