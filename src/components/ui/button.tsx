import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "light" | "outline-dark" | "danger" | "danger-outline";
type Size = "md" | "sm" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "border-0 bg-accent text-white hover:bg-accent-strong",
  dark: "border border-ink bg-ink text-on-ink hover:bg-ink-soft",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-subtle",
  ghost: "border-0 bg-transparent text-ink hover:bg-subtle",
  // light and outline-dark sit on a dark panel in both themes
  light: "border-0 bg-white text-panel hover:bg-[#E9ECF1]",
  "outline-dark": "border border-dark-line bg-transparent text-white hover:bg-dark-raised",
  danger: "border border-warn-strong bg-warn-strong text-white hover:bg-[#8F2F06]",
  "danger-outline": "border border-line-strong bg-surface text-warn-ink hover:bg-warn-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] rounded-lg",
  md: "min-h-11 px-4 text-sm rounded-[10px]",
  lg: "h-12 px-5 text-[15px] rounded-[10px]",
  icon: "size-11 shrink-0 text-xl rounded-[10px]",
};

export function buttonClasses({ variant = "secondary", size = "md", className = "" }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return [
    "inline-flex items-center justify-center gap-2 font-semibold no-underline transition-colors cursor-pointer",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  ].join(" ");
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
