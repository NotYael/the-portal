import { afterEach, describe, expect, it, vi } from "vitest";
import type { DigestData } from "../digest";
import { digestDataSchema, digestEmail, escapeHtml } from "./digest-email";
import { sendEmail } from "./resend";

const digest: DigestData = {
  week: 44,
  rangeLabel: "26 Oct – 1 Nov 2026",
  sendLabel: "Sunday 1 Nov, 8:00 PM",
  name: "Danyael",
  wins: ["Shipped <reminders>"],
  targets: [],
  expenses: { thisWeek: 4200, lastWeek: 5000, diff: -800, monthUsedPct: 61, topCategory: "Food" },
  goals: { onTrack: 2, total: 3, behind: ["Health"] },
  jobs: { fresh: 4, topMatch: 91 },
  reminders: [
    { id: "a", title: "Renew the domain", when: "was due Oct 28", overdue: true },
    { id: "b", title: "Push a commit", when: "Wed, Nov 4", overdue: false },
  ],
  note: "2 of 3 goals are on track.",
  subject: "Week 44: 1 win, 0 targets",
};

describe("digestEmail", () => {
  it("renders every section, escaped, with the reminders", () => {
    const { subject, html, text } = digestEmail(digest, "https://portal.example");
    expect(subject).toBe("Week 44: 1 win, 0 targets");
    expect(html).toContain("Shipped &lt;reminders&gt;");
    expect(html).not.toContain("<reminders>");
    expect(html).toContain("Reminders for the week ahead");
    expect(html).toContain("Renew the domain");
    expect(html).toContain("₱4,200");
    expect(html).toContain('href="https://portal.example"');
    expect(text).toContain("- Push a commit (Wed, Nov 4)");
    expect(text).toContain("No targets yet.");
  });

  it("marks test sends and leaves out empty optional sections", () => {
    const { subject, html, text } = digestEmail({ ...digest, reminders: [], expenses: null }, "http://localhost:3000", { test: true });
    expect(subject).toBe("[Test] Week 44: 1 win, 0 targets");
    expect(html).not.toContain("Reminders for the week ahead");
    expect(html).not.toContain("Spent this week");
    expect(text).not.toContain("REMINDERS");
  });

  it("validates what the page sends", () => {
    expect(digestDataSchema.safeParse(digest).success).toBe(true);
    expect(digestDataSchema.safeParse({ ...digest, reminders: "nope" }).success).toBe(false);
  });

  it("escapes quotes too", () => {
    expect(escapeHtml(`"a" & 'b'`)).toBe("&quot;a&quot; &amp; &#39;b&#39;");
  });
});

describe("sendEmail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts to Resend with the fixed recipient", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendEmail({ subject: "s", html: "<p>h</p>", text: "t" }, { apiKey: "re_test", to: "me@example.com" })).toEqual({
      ok: true,
      id: "em_1",
      to: "me@example.com",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body).to).toEqual(["me@example.com"]);
  });

  it("reports Resend's error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Invalid API key" }), { status: 401 })));
    expect(await sendEmail({ subject: "s", html: "h", text: "t" }, { apiKey: "re_bad", to: "me@example.com" })).toEqual({
      ok: false,
      error: "Invalid API key",
    });
  });

  it("needs a key and a recipient", async () => {
    const message = { subject: "s", html: "h", text: "t" };
    expect(await sendEmail(message, { apiKey: "", to: "me@example.com" })).toEqual({ ok: false, error: "RESEND_API_KEY isn’t set." });
    expect(await sendEmail(message, { apiKey: "re_test", to: "" })).toEqual({ ok: false, error: "DIGEST_TO_EMAIL isn’t set." });
  });
});
