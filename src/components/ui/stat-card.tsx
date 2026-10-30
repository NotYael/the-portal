import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  note,
  valueClassName = "",
  display = false,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  note?: ReactNode;
  valueClassName?: string;
  /** Text values (like a category name) use the display face instead of mono. */
  display?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[16px] border border-line bg-surface p-4 sm:p-5">
      <span className="text-[13px] text-muted">{label}</span>
      <span
        className={`${display ? "font-display text-xl font-bold sm:text-2xl" : "font-mono text-[22px] sm:text-[26px]"} leading-tight ${valueClassName}`}
      >
        {value}
      </span>
      {children}
      {sub ? <span className="text-[13px] text-muted">{sub}</span> : null}
      {note ? <span className="text-xs text-muted">{note}</span> : null}
    </div>
  );
}
