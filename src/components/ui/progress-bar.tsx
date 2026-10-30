/** Decorative bar; always pair it with a visible value or label. */
export function ProgressBar({
  ratio,
  color = "var(--accent)",
  height = 6,
  track = "var(--track)",
}: {
  ratio: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const width = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div aria-hidden="true" className="w-full overflow-hidden" style={{ height, borderRadius: height / 2, background: track }}>
      <div style={{ width: `${width}%`, height, borderRadius: height / 2, background: color }} />
    </div>
  );
}

/** A 100% stacked horizontal bar, with a hairline gap between segments. */
export function StackedBar({ parts, height = 14 }: { parts: { value: number; color: string }[]; height?: number }) {
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div
      aria-hidden="true"
      className={`flex w-full gap-0.5 overflow-hidden ${shown.length ? "" : "bg-track"}`}
      style={{ height, borderRadius: height / 2 }}
    >
      {shown.map((p, i) => (
        <div key={i} style={{ flex: `${p.value} 1 0`, background: p.color }} />
      ))}
    </div>
  );
}
