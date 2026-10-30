import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", gap = "gap-4", ...props }: HTMLAttributes<HTMLElement> & { gap?: string }) {
  return (
    <section
      className={`flex min-w-0 flex-col ${gap} rounded-[16px] border border-line bg-surface p-4 sm:p-6 ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ title, aside, as: Tag = "h2" }: { title: ReactNode; aside?: ReactNode; as?: "h2" | "h3" }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <Tag className="m-0 font-display text-xl font-bold">{title}</Tag>
      {aside}
    </div>
  );
}

export function Eyebrow({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "warn" | "muted" }) {
  const color = tone === "accent" ? "text-accent" : tone === "warn" ? "text-warn-ink" : "text-muted";
  return <span className={`text-xs font-semibold uppercase tracking-[0.06em] ${color}`}>{children}</span>;
}
