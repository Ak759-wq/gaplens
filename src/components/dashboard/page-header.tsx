export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-9 flex flex-col gap-4 border-b border-[#e3e3de] pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-3 font-sans text-[11px] font-medium tracking-[0.18em] text-[#6b706f] uppercase">{eyebrow}</p>
        )}
        <h1 className="font-display text-[34px] leading-[1.08] font-medium tracking-[-0.015em] text-[#202322] sm:text-[42px]">
          {title}
        </h1>
        {description && <p className="mt-4 text-[15px] leading-[1.65] text-[#6b706f]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
