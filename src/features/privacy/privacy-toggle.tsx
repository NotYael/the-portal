"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { setAmountsHidden } from "@/lib/privacy";
import { useAmountsHidden } from "@/lib/use-amounts-hidden";
import { supabaseConfigured } from "@/lib/supabase/config";
import { checkPassword } from "./check-password";

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.7 3.6M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        <path d="m3 3 18 18" />
      </>
    ) : (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

/** Eye button: hides or shows every amount, after asking for the account password. */
export function PrivacyToggle() {
  const hidden = useAmountsHidden();
  const [asking, setAsking] = useState(false);
  const label = hidden ? "Show amounts" : "Hide amounts";

  return (
    <>
      <Button size="icon" aria-pressed={hidden} aria-label="Hide amounts" title={label} onClick={() => setAsking(true)}>
        <EyeIcon off={hidden} />
      </Button>
      {asking ? <PasswordDialog hiding={!hidden} onClose={() => setAsking(false)} /> : null}
    </>
  );
}

function PasswordDialog({ hiding, onClose }: { hiding: boolean; onClose: () => void }) {
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return setError("Enter your password.");
    setChecking(true);
    setError(null);
    const result = await checkPassword(password).catch(() => ({ ok: false as const, error: "Couldn’t check your password right now. Try again." }));
    setChecking(false);
    if (!result.ok) {
      setError(result.error);
      setPassword("");
      input.current?.focus();
      return;
    }
    setAmountsHidden(hiding);
    toast(hiding ? "Amounts hidden" : "Amounts shown");
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="privacy-title"
      aria-describedby="privacy-desc"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current && !checking) dialog.current.close();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[400px] rounded-[16px] bg-surface p-0 text-ink shadow-2xl"
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1.5">
          <h2 id="privacy-title" className="m-0 font-display text-xl font-bold">
            {hiding ? "Hide amounts" : "Show amounts"}
          </h2>
          <p id="privacy-desc" className="m-0 text-sm text-muted">
            {hiding
              ? "Every amount in the Portal will show as *******, and editing is locked, until you enter your password again."
              : "Enter your password to show amounts again."}
            {supabaseConfigured ? "" : " Demo mode: any password works."}
          </p>
        </div>
        <Field id="privacy-password" label="Password" error={error}>
          <TextInput
            ref={input}
            id="privacy-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!error}
            readOnly={checking}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => dialog.current?.close()} disabled={checking}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" disabled={checking}>
            {checking ? "Checking…" : hiding ? "Hide amounts" : "Show amounts"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
