/**
 * The weekly digest as an email: the same sections as the in-app preview
 * (features/digest/digest-email.tsx), as plain HTML with inline styles,
 * because email clients drop stylesheets and CSS variables. Colors are the
 * light palette from styles/tokens.css.
 */
import { z } from "zod";
import type { DigestData } from "../digest";
import { peso } from "../format";

/** What the /digest page sends to the test route: a DigestData it built. */
export const digestDataSchema = z.object({
  week: z.number().int(),
  rangeLabel: z.string().max(100),
  sendLabel: z.string().max(100),
  name: z.string().max(80),
  wins: z.array(z.string().max(20000)).max(5),
  targets: z.array(z.string().max(20000)).max(4),
  expenses: z
    .object({
      thisWeek: z.number(),
      lastWeek: z.number(),
      diff: z.number(),
      monthUsedPct: z.number().nullable(),
      topCategory: z.string().max(60).nullable(),
    })
    .nullable(),
  goals: z.object({ onTrack: z.number().int(), total: z.number().int(), behind: z.array(z.string().max(40)).max(20) }),
  jobs: z.object({ fresh: z.number().int(), topMatch: z.number().nullable() }),
  reminders: z
    .array(z.object({ id: z.string().max(64), title: z.string().max(120), when: z.string().max(40), overdue: z.boolean() }))
    .max(50),
  note: z.string().max(2000),
  subject: z.string().max(200),
}) satisfies z.ZodType<DigestData>;

const C = {
  bg: "#f3f4f6",
  surface: "#ffffff",
  ink: "#111418",
  muted: "#5b6270",
  divider: "#eef0f3",
  panel: "#111418",
  panelMuted: "#b9bfca",
  accent: "#2f5bff",
  accentInk: "#1e3fcc",
  warnInk: "#b23d0a",
};
const FONT = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', SFMono-Regular, Consolas, monospace";

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

const section = (inner: string) => `<div style="padding:28px 36px;border-bottom:1px solid ${C.divider};">${inner}</div>`;
const heading = (text: string, color: string) =>
  `<h3 style="margin:0 0 12px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${color};">${escapeHtml(text)}</h3>`;

function list(title: string, color: string, items: string[], empty: string) {
  const body = items.length
    ? `<ol style="margin:0;padding-left:20px;">${items.map((t) => `<li style="margin:0 0 10px;font-size:15px;line-height:1.5;">${escapeHtml(t)}</li>`).join("")}</ol>`
    : `<p style="margin:0;font-size:15px;color:${C.muted};">${escapeHtml(empty)}</p>`;
  return section(heading(title, color) + body);
}

function stat(label: string, value: string, detail: string, detailColor: string) {
  return `<td style="vertical-align:top;padding:0 16px 0 0;">
<p style="margin:0;font-size:13px;color:${C.muted};">${escapeHtml(label)}</p>
<p style="margin:4px 0 0;font-family:${MONO};font-size:22px;">${escapeHtml(value)}</p>
<p style="margin:2px 0 0;font-size:13px;color:${detailColor};">${escapeHtml(detail)}</p>
</td>`;
}

/** Subject, HTML and plain-text bodies for the digest. `appUrl` is where "Open The Portal" points. */
export function digestEmail(digest: DigestData, appUrl: string, { test = false } = {}) {
  const { expenses, goals, jobs, reminders } = digest;
  const subject = `${test ? "[Test] " : ""}${digest.subject}`;
  const greeting = `${digest.wins.length >= 3 ? "Good week" : "Your week"}, ${digest.name}.`;

  const stats = [
    expenses
      ? stat(
          "Spent this week",
          peso(expenses.thisWeek),
          `${peso(Math.abs(expenses.diff))} ${expenses.diff <= 0 ? "less" : "more"} than last week`,
          expenses.diff <= 0 ? C.accentInk : C.warnInk,
        )
      : "",
    stat(
      "Goals on track",
      `${goals.onTrack} / ${goals.total}`,
      goals.behind.length ? `${goals.behind.join(", ")} behind` : "all on pace",
      goals.behind.length ? C.warnInk : C.muted,
    ),
    stat("Job agent", `${jobs.fresh} new`, jobs.topMatch ? `top match ${jobs.topMatch}%` : "no new matches", C.muted),
  ].join("");

  const reminderSection = reminders.length
    ? section(
        heading("Reminders for the week ahead", C.muted) +
          `<ul style="margin:0;padding-left:20px;">${reminders
            .map(
              (r) =>
                `<li style="margin:0 0 10px;font-size:15px;line-height:1.5;">${escapeHtml(r.title)} <span style="color:${r.overdue ? C.warnInk : C.muted};${r.overdue ? "font-weight:600;" : ""}">· ${escapeHtml(r.when)}</span></li>`,
            )
            .join("")}</ul>`,
      )
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:${C.bg};font-family:${FONT};color:${C.ink};">
<div style="max-width:640px;margin:0 auto;background:${C.surface};border-radius:16px;overflow:hidden;">
<div style="padding:32px 36px;background:${C.panel};color:#ffffff;">
<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${C.panelMuted};">The Portal · Weekly digest</p>
<h2 style="margin:0;font-size:30px;line-height:1.2;font-weight:700;">${escapeHtml(greeting)}</h2>
<p style="margin:8px 0 0;font-size:15px;color:#d5d9e0;">${escapeHtml(digest.rangeLabel)}</p>
</div>
${list("Wins this week", C.accentInk, digest.wins, "No wins logged yet — tag a journal entry as Win.")}
${list("Targets for next week", C.warnInk, digest.targets, "No targets yet — tag a journal entry as Target.")}
${reminderSection}
${section(`<table role="presentation" style="border-collapse:collapse;width:100%;"><tr>${stats}</tr></table>`)}
${section(heading("Summary", C.muted) + `<p style="margin:0;font-size:15px;line-height:1.6;">${escapeHtml(digest.note)}</p>`)}
<div style="padding:28px 36px 32px;">
<a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:${C.accent};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Open The Portal</a>
</div>
</div>
</body></html>`;

  const lines = [
    greeting,
    digest.rangeLabel,
    "",
    "WINS THIS WEEK",
    ...(digest.wins.length ? digest.wins.map((w, i) => `${i + 1}. ${w}`) : ["No wins logged yet."]),
    "",
    "TARGETS FOR NEXT WEEK",
    ...(digest.targets.length ? digest.targets.map((t, i) => `${i + 1}. ${t}`) : ["No targets yet."]),
    ...(reminders.length ? ["", "REMINDERS FOR THE WEEK AHEAD", ...reminders.map((r) => `- ${r.title} (${r.when})`)] : []),
    "",
    ...(expenses ? [`Spent this week: ${peso(expenses.thisWeek)}`] : []),
    `Goals on track: ${goals.onTrack} / ${goals.total}`,
    `Job agent: ${jobs.fresh} new`,
    "",
    digest.note,
    "",
    `Open The Portal: ${appUrl}`,
  ];

  return { subject, html, text: lines.join("\n") };
}
