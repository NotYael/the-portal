/**
 * "Hide amounts": shows every peso amount as ******* so the Portal can be
 * shown to other people. The money formatters in format.ts check it, so
 * insights, chart labels and screen-reader labels are covered too. The
 * switch asks for the account password both ways (features/privacy), and
 * components read it with useAmountsHidden() (use-amounts-hidden.ts). This
 * file has no React import so server code can use the formatters.
 *
 * Remembered per browser. It keeps amounts off the screen; it isn't
 * encryption: the data is still loaded in the page.
 */
export const MASK = "*******";

const STORAGE_KEY = "the-portal.hide-amounts";

let hidden: boolean | null = null;
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether amounts are hidden right now. Always false on the server. */
export function amountsHidden(): boolean {
  if (typeof window === "undefined") return false;
  hidden ??= readStored();
  return hidden;
}

// "₱1,240", "₱ 1.5k", "PHP 1,240.50", "1,240 pesos"
const AMOUNT_IN_TEXT = /(?:₱|\bPHP)\s?\d[\d,]*(?:\.\d+)?k?\b|\b\d[\d,]*(?:\.\d+)?k?\s?(?:pesos|php)\b/gi;

/** Masks peso amounts in free text, such as AI answers, that didn't come from the formatters. */
export function maskAmounts(text: string): string {
  return text.replace(AMOUNT_IN_TEXT, MASK);
}

export function setAmountsHidden(next: boolean) {
  hidden = next;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage: keep the setting for this page load only.
  }
  for (const listener of listeners) listener();
}

export function subscribeAmountsHidden(listener: () => void) {
  listeners.add(listener);
  // Another tab switched it.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    hidden = event.newValue === "1";
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
