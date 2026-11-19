import { describe, expect, it } from "vitest";
import { seedPortal } from "../data/seed";
import { buildDigest, type DigestData } from "../digest";
import { acceptDigest, digestAiData, digestPrompt, summarizeDigest } from "./digest-ai";
import type { AiResult, GenerateRequest } from "./gemini";

const SUNDAY = "2026-11-22";

function sampleDigest(): DigestData {
  const digest = buildDigest(seedPortal(SUNDAY), SUNDAY);
  // Pin the journal so the test doesn't depend on the seed's tags.
  return { ...digest, wins: ["Shipped the emissions import after two weeks of fighting it."], targets: ["Two mock interviews before Friday."] };
}

const answer = (digest: DigestData, extra: Partial<Record<string, unknown>> = {}) => ({
  subject: `Week ${digest.week}: spending down, one win`,
  note: "Spending came in under last week, and the job search turned up fresh matches worth a look.",
  wins: ["Shipped the emissions import."],
  targets: ["Two mock interviews by Friday."],
  ...extra,
});

describe("digestAiData", () => {
  it("sends only counts from the journal while the setting is off", () => {
    const digest = sampleDigest();
    const data = digestAiData(digest, false);
    expect(data.journal).toEqual({ winCount: 1, targetCount: 1 });
    expect(digestPrompt(data)).not.toContain("emissions");
  });

  it("includes Win and Target text only with the opt-in", () => {
    const digest = sampleDigest();
    expect(digestAiData(digest, true).journal).toEqual({ wins: digest.wins, targets: digest.targets });
  });

  it("never sends reminder titles", () => {
    const digest = { ...sampleDigest(), reminders: [{ id: "r1", title: "Renew passport", when: "Tue, Nov 24", overdue: false }] };
    const prompt = digestPrompt(digestAiData(digest, true));
    expect(prompt).not.toContain("passport");
    expect(digestAiData(digest, false).reminders).toEqual({ dueInWeekAhead: 1, overdue: 0 });
  });
});

describe("acceptDigest", () => {
  it("takes the subject and note, and keeps the original entries when the journal is off", () => {
    const digest = sampleDigest();
    expect(acceptDigest(answer(digest), digest, false)).toEqual({
      subject: `Week ${digest.week}: spending down, one win`,
      note: answer(digest).note,
      wins: digest.wins,
      targets: digest.targets,
    });
  });

  it("uses the tidied bullets when the journal is on", () => {
    const digest = sampleDigest();
    expect(acceptDigest(answer(digest), digest, true)?.wins).toEqual(["Shipped the emissions import."]);
  });

  it("rejects added or dropped bullets", () => {
    const digest = sampleDigest();
    expect(acceptDigest(answer(digest, { wins: ["One", "Two invented win"] }), digest, true)).toBeNull();
    expect(acceptDigest(answer(digest, { targets: [] }), digest, true)).toBeNull();
  });

  it("rejects a subject for the wrong week and malformed answers", () => {
    const digest = sampleDigest();
    expect(acceptDigest(answer(digest, { subject: "Week 1: wrong" }), digest, false)).toBeNull();
    expect(acceptDigest(answer(digest, { note: "Too short" }), digest, false)).toBeNull();
    expect(acceptDigest({ subject: 4 }, digest, false)).toBeNull();
  });
});

describe("summarizeDigest", () => {
  it("merges Gemini's answer into the digest", async () => {
    const digest = sampleDigest();
    const generate = async <T,>(request: GenerateRequest<T>): Promise<AiResult<T>> => {
      const data = request.accept(answer(digest));
      return data === null ? { ok: false, reason: "unavailable" } : { ok: true, data, model: "test" };
    };
    const { digest: written, source } = await summarizeDigest(digest, false, generate);
    expect(source).toBe("ai");
    expect(written.subject).toBe(`Week ${digest.week}: spending down, one win`);
    expect(written.expenses).toEqual(digest.expenses);
  });

  it("keeps the template digest when AI isn't available", async () => {
    const digest = sampleDigest();
    const generate = async () => ({ ok: false as const, reason: "busy" as const });
    expect(await summarizeDigest(digest, true, generate)).toEqual({ digest, source: "template" });
  });
});
