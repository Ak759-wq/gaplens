export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-[#e3e3de] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-3 font-sans text-[11px] font-medium tracking-[0.2em] text-[#6b706f] uppercase">{eyebrow}</p>
        )}
        <h1 className="font-display text-[36px] leading-[1.06] font-medium tracking-[-0.02em] text-[#202322] sm:text-[46px]">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-[1060px] text-[15.5px] leading-[1.65] text-[#6b706f]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
