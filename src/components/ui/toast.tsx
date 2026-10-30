"use client";

import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";

/** A button in the toast, e.g. Undo. Clicking it runs onClick and closes the toast. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
}

type ShowToast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const close = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback<ShowToast>(
    (message, action) => {
      const id = ++nextId.current;
      setToasts((list) => [...list, { id, message, action }]);
      // Toasts with a button stay longer, so there's time to reach it.
      setTimeout(() => close(id), action ? 6000 : 3500);
    },
    [close],
  );

  return (
    <ToastContext value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-[10px] bg-ink px-4 py-3 text-sm font-medium text-on-ink shadow-lg">
            <span>{t.message}</span>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  close(t.id);
                }}
                className="pointer-events-auto -my-1 min-h-9 cursor-pointer rounded-lg px-2 font-semibold underline underline-offset-2"
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const show = use(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
