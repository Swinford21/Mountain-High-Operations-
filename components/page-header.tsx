export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string
  description?: React.ReactNode
  eyebrow?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 border-b bg-card px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-6">
      <div className="flex flex-col gap-1">
        {eyebrow && <p className="text-xs font-semibold tracking-widest text-brand-red uppercase">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-extrabold tracking-wide text-balance uppercase sm:text-4xl">{title}</h1>
        {description && <p className="leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function PageBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-6 px-4 py-6 sm:px-8 ${className}`}>{children}</div>
}

export function OperationDot({ color, className = '' }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
    />
  )
}
