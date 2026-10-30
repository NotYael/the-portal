import type { ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const controlBase =
  "w-full min-w-0 rounded-[10px] border border-line-strong bg-surface text-ink placeholder:text-muted disabled:bg-subtle disabled:text-muted aria-invalid:border-warn-ink";

export function Field({
  id,
  label,
  error,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="m-0 text-[13px] text-warn-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="m-0 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  className = "",
  invalid,
  large = false,
  ...props
}: ComponentProps<"input"> & { invalid?: boolean; large?: boolean }) {
  return (
    <input
      className={`${controlBase} px-3 ${large ? "h-12 text-[15px]" : "h-11 text-sm"} ${className}`}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlBase} h-11 px-2.5 text-sm ${className}`} {...props} />;
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-[12px] border border-line-strong bg-surface p-4 text-base leading-relaxed text-ink placeholder:text-muted ${className}`}
      {...props}
    />
  );
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" className="size-5 accent-accent" {...props} />
      {label}
    </label>
  );
}
