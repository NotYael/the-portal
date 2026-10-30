import { themedColor } from "@/lib/theme";

export function Dot({ color, size = 8, square = false }: { color: string; size?: number; square?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0"
      style={{ width: size, height: size, borderRadius: square ? 3 : "50%", background: themedColor(color) }}
    />
  );
}
