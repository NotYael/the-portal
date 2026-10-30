"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { buildDigest } from "@/lib/digest";
import { DIGEST_FROM } from "@/lib/email/addresses";
import { useExpenseBook } from "@/lib/data/expense-book";
import { useJobBoard } from "@/lib/data/job-board";
import { useReminders } from "@/lib/data/reminders";
import { usePortalData, useToday } from "@/lib/data/store";
import { DigestEmail } from "./digest-email";

export function DigestView() {
  const portal = usePortalData();
  const { book, error: bookError } = useExpenseBook();
  const today = useToday();
  const toast = useToast();
  const { board, error } = useJobBoard();
  const { reminders: reminderRows, error: remindersError } = useReminders();
  const [sending, setSending] = useState(false);

  // If the jobs can't load, the digest still previews everything else.
  const jobs = board?.jobs ?? (error ? [] : null);
  const reminders = reminderRows ?? (remindersError ? [] : null);
  if (!portal || !today || !jobs || !reminders || (!book && !bookError)) return <PageSkeleton cards={3} label="Loading digest" />;
  if (!book) {
    return (
      <>
        <PageHeader kicker="This week so far" title="Weekly digest" />
        <p role="alert" className="m-0 rounded-[12px] bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          {bookError}
        </p>
      </>
    );
  }
  const data = { ...portal, ...book };

  const digest = buildDigest({ ...data, jobs }, today, reminders);

  const sendTest = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/digest/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(digest),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; to?: string } | null;
      toast(res.ok ? `Test sent to ${body?.to ?? "your inbox"}` : (body?.error ?? "Couldn’t send the test. Try again."));
    } catch {
      toast("Couldn’t reach the server. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        kicker={`This week so far · sends ${digest.sendLabel}`}
        title="Weekly digest"
        actions={
          <Button variant="primary" onClick={sendTest} disabled={sending}>
            {sending ? "Sending…" : "Send test"}
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 rounded-[16px] bg-track p-3 sm:p-8">
        <dl className="m-0 flex flex-col gap-1 rounded-[12px] bg-surface px-5 py-4 text-[13px]">
          <div className="flex gap-2">
            <dt className="text-muted">From</dt>
            <dd className="m-0">{DIGEST_FROM}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">Sends</dt>
            <dd className="m-0">{digest.sendLabel}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="sr-only">Subject</dt>
            <dd className="m-0 text-[15px] font-semibold">{digest.subject}</dd>
          </div>
        </dl>

        <DigestEmail digest={digest} />

        <p className="m-0 text-center text-xs text-muted">
          Sent every Sunday at 8:00 PM ·{" "}
          {data.settings.include_in_digest ? "Expenses included" : "Expenses left out (change in Expenses → Settings)"}
        </p>
      </div>
    </>
  );
}
