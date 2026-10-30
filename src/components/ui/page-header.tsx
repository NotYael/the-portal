import type { ReactNode } from "react";

export function PageHeader({ kicker, title, actions }: { kicker?: ReactNode; title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <p className="m-0 text-[13px] text-muted">{kicker}</p> : null}
        <h1 className="mt-1 mb-0 font-display text-[28px] font-bold tracking-[-0.02em] sm:text-4xl">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
