/** `inverted` is for dark panels, which stay dark in both themes. */
export function LogoMark({ size = 28, inverted = false }: { size?: number; inverted?: boolean }) {
  const ring = Math.round(size * 0.36);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.28, background: inverted ? "#FFFFFF" : "var(--ink)" }}
    >
      <span
        style={{
          width: ring,
          height: ring,
          borderRadius: "50%",
          border: `${size > 30 ? 3 : 2}px solid ${inverted ? "var(--panel)" : "var(--on-ink)"}`,
        }}
      />
    </span>
  );
}
