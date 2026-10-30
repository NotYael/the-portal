import Link from "next/link";
import type { DigestData } from "@/lib/digest";
import { peso } from "@/lib/format";

/** The email body, matching the "Weekly digest email" artboard. */
export function DigestEmail({ digest }: { digest: DigestData }) {
  const { expenses, goals, jobs } = digest;
  return (
    <div className="flex flex-col overflow-hidden rounded-[16px] bg-surface">
      <div className="flex flex-col gap-2 bg-panel px-6 py-8 text-white sm:px-9">
        <span className="font-display text-[15px] font-bold text-dark-muted">The Portal · Weekly digest</span>
        <h2 className="m-0 font-display text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[34px]">
          {digest.wins.length >= 3 ? "Good week" : "Your week"}, {digest.name}.
        </h2>
        <p className="m-0 text-[15px] text-[#D5D9E0]">{digest.rangeLabel}</p>
      </div>

      <DigestList title="Wins this week" tone="text-accent-ink" items={digest.wins} empty="No wins logged yet — tag a journal entry as Win." />
      <DigestList title="Targets for next week" tone="text-warn-ink" items={digest.targets} empty="No targets yet — tag a journal entry as Target." />

      {digest.reminders.length ? (
        <div className="flex flex-col gap-2.5 border-b border-divider px-6 py-7 sm:px-9">
          <h3 className="m-0 mb-1 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">Reminders for the week ahead</h3>
          <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5">
            {digest.reminders.map((r) => (
              <li key={r.id} className="text-[15px] leading-normal">
                {r.title} <span className={r.overdue ? "font-semibold text-warn-ink" : "text-muted"}>· {r.when}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 border-b border-divider px-6 py-7 sm:px-9">
        {expenses ? (
          <div>
            <p className="m-0 text-[13px] text-muted">Spent this week</p>
            <p className="mt-1 mb-0 font-mono text-[22px]">{peso(expenses.thisWeek)}</p>
            <p className={`mt-0.5 mb-0 text-[13px] ${expenses.diff <= 0 ? "text-accent-ink" : "text-warn-ink"}`}>
              {peso(Math.abs(expenses.diff))} {expenses.diff <= 0 ? "less" : "more"} than last week
            </p>
          </div>
        ) : null}
        <div>
          <p className="m-0 text-[13px] text-muted">Goals on track</p>
          <p className="mt-1 mb-0 font-mono text-[22px]">
            {goals.onTrack} / {goals.total}
          </p>
          <p className={`mt-0.5 mb-0 text-[13px] ${goals.behind.length ? "text-warn-ink" : "text-muted"}`}>
            {goals.behind.length ? `${goals.behind.join(", ")} behind` : "all on pace"}
          </p>
        </div>
        <div>
          <p className="m-0 text-[13px] text-muted">Job agent</p>
          <p className="mt-1 mb-0 font-mono text-[22px]">{jobs.fresh} new</p>
          <p className="mt-0.5 mb-0 text-[13px] text-muted">{jobs.topMatch ? `top match ${jobs.topMatch}%` : "no new matches"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-b border-divider px-6 py-7 sm:px-9">
        <h3 className="m-0 mb-1 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">Summary</h3>
        <p className="m-0 text-[15px] leading-relaxed">{digest.note}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-6 pt-7 pb-8 sm:px-9">
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-[10px] bg-accent px-5 text-[15px] font-semibold text-white no-underline hover:bg-accent-strong hover:text-white"
        >
          Open The Portal
        </Link>
        <Link href="/journal" className="text-sm font-semibold">
          Edit next week’s targets
        </Link>
      </div>
    </div>
  );
}

function DigestList({ title, tone, items, empty }: { title: string; tone: string; items: string[]; empty: string }) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-divider px-6 py-7 sm:px-9">
      <h3 className={`m-0 mb-1 text-[13px] font-semibold tracking-[0.06em] uppercase ${tone}`}>{title}</h3>
      {items.length ? (
        <ol className="m-0 flex list-decimal flex-col gap-2.5 pl-5">
          {items.map((text, i) => (
            <li key={i} className="text-[15px] leading-normal">
              {text}
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 text-[15px] text-muted">{empty}</p>
      )}
    </div>
  );
}
