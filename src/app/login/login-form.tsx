"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { startMockSession } from "@/lib/auth/session-cookie";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const enterDemo = () => {
    setPending(true);
    // Demo mode: any well-formed credentials open the demo workspace.
    setTimeout(() => {
      startMockSession();
      window.location.assign(safeNext());
    }, 350);
  };

  const signIn = async () => {
    setPending(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return window.location.assign(safeNext());
    setPending(false);
    setErrors({
      form:
        error.code === "invalid_credentials"
          ? "Wrong email or password."
          : error.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Couldn’t log in right now. Try again in a moment.",
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your email.";
    else if (!EMAIL.test(email.trim())) next.email = "That doesn’t look like an email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setNotice(null);
    if (Object.keys(next).length > 0) return;
    if (supabaseConfigured) void signIn();
    else enterDemo();
  };

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-6">
      <div>
        <h2 className="m-0 font-display text-[30px] font-bold tracking-[-0.02em]">Welcome back</h2>
        <p className="mt-1.5 mb-0 text-[15px] text-muted">Private workspace — invite only.</p>
      </div>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field id="email" label="Email" error={errors.email}>
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!errors.email}
            large
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-[13px] font-semibold">
              Password
            </label>
            <button
              type="button"
              onClick={() =>
                setNotice(
                  supabaseConfigured
                    ? "Password reset emails aren’t set up yet. Reset it in Supabase → Authentication → Users."
                    : "Password reset emails start working once Supabase Auth is connected.",
                )
              }
              className="cursor-pointer text-[13px] text-accent underline hover:text-accent-ink"
            >
              Forgot?
            </button>
          </div>
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!errors.password}
            large
          />
          {errors.password ? (
            <p id="password-error" className="m-0 text-[13px] text-warn-ink">
              {errors.password}
            </p>
          ) : null}
        </div>
        {errors.form ? (
          <p role="alert" className="m-0 rounded-[10px] bg-warn-soft px-3 py-2.5 text-[13px] text-warn-ink">
            {errors.form}
          </p>
        ) : null}
        <Button type="submit" variant="dark" size="lg" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
        {notice ? (
          <p role="status" className="m-0 rounded-[10px] bg-accent-soft px-3 py-2.5 text-[13px] text-accent-ink">
            {notice}
          </p>
        ) : null}
      </form>

      {supabaseConfigured ? null : (
        <>
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <div className="h-px grow bg-line" />
            or
            <div className="h-px grow bg-line" />
          </div>

          <Button variant="secondary" size="lg" disabled={pending} onClick={enterDemo}>
            Continue with Google
          </Button>

          <p className="m-0 text-[13px] leading-normal text-muted">
            Demo mode: any email and password open the workspace until Supabase Auth is connected.
          </p>
        </>
      )}
    </div>
  );
}
