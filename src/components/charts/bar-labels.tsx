/**
 * X-axis labels rendered as real buttons under a chart, one equal-width column
 * per bar, so "click a bar to open that month" also works from the keyboard.
 * `short` replaces the label on phones, where 12 columns can't fit "Jan".
 */
export function BarLabelButtons({
  items,
}: {
  items: { key: string; label: string; short?: string; ariaLabel: string; selected?: boolean; disabled?: boolean; onClick: () => void }[];
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          disabled={item.disabled}
          aria-label={item.ariaLabel}
          aria-current={item.selected ? "true" : undefined}
          className={[
            "min-h-11 cursor-pointer truncate rounded-lg px-0.5 text-xs whitespace-nowrap text-ink-soft hover:bg-subtle disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent",
            item.selected ? "font-bold text-ink" : "font-semibold",
          ].join(" ")}
        >
          {item.short ? (
            <>
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </>
          ) : (
            item.label
          )}
        </button>
      ))}
    </div>
  );
}
