import { describe, expect, it, vi } from "vitest";
import { seedPortal } from "./data/seed";
import { cronAuthorized, runWeeklyDigest, type Claim, type DigestCronSteps } from "./digest-cron";

// Sunday 22 Nov 2026; its week starts Monday 16 Nov.
const SUNDAY = "2026-11-22";

function steps(overrides: Partial<DigestCronSteps> = {}) {
  const finish = vi.fn<DigestCronSteps["finish"]>(async () => {});
  const send = vi.fn<DigestCronSteps["send"]>(async () => ({ ok: true, id: "re_123", to: "me@example.test" }));
  const all: DigestCronSteps = {
    claim: async (): Promise<Claim> => ({ id: "run-1" }),
    load: async () => ({ state: seedPortal(SUNDAY), reminders: [], journalAiSummary: false }),
    summarize: async (digest) => digest,
    send,
    finish,
    ...overrides,
  };
  return { all, finish, send };
}

describe("cronAuthorized", () => {
  it("accepts only the exact bearer secret", () => {
    expect(cronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(cronAuthorized("Bearer wrong", "s3cret")).toBe(false);
    expect(cronAuthorized("s3cret", "s3cret")).toBe(false);
    expect(cronAuthorized(null, "s3cret")).toBe(false);
  });

  it("lets nobody in when CRON_SECRET isn't set", () => {
    expect(cronAuthorized("Bearer ", undefined)).toBe(false);
    expect(cronAuthorized("Bearer ", "")).toBe(false);
  });
});

describe("runWeeklyDigest", () => {
  it("claims the week, sends the digest and records the send", async () => {
    const claim = vi.fn<DigestCronSteps["claim"]>(async () => ({ id: "run-1" }));
    const { all, finish, send } = steps({ claim });
    const result = await runWeeklyDigest(all, SUNDAY);

    expect(claim).toHaveBeenCalledWith("2026-11-16");
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].subject).toMatch(/^Week \d+:/);
    expect(finish).toHaveBeenCalledWith("run-1", { status: "sent", resendId: "re_123" });
    expect(result).toEqual({ status: "sent", weekStart: "2026-11-16", resendId: "re_123" });
  });

  it("sends the summarized digest", async () => {
    const { all, send } = steps({ summarize: async (digest) => ({ ...digest, subject: "Week 47: written by Gemini" }) });
    await runWeeklyDigest(all, SUNDAY);
    expect(send.mock.calls[0][0].subject).toBe("Week 47: written by Gemini");
  });

  it("sends the template digest when summarizing fails", async () => {
    const { all, send } = steps({
      summarize: async () => {
        throw new Error("gemini down");
      },
    });
    expect(await runWeeklyDigest(all, SUNDAY)).toMatchObject({ status: "sent" });
    expect(send.mock.calls[0][0].subject).toMatch(/^Week \d+:/);
  });

  it("sends nothing when the week was already sent", async () => {
    const { all, finish, send } = steps({ claim: async () => "taken" });
    expect(await runWeeklyDigest(all, SUNDAY)).toEqual({ status: "already-sent", weekStart: "2026-11-16" });
    expect(send).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it("marks the run failed (freeing the week) when Resend fails", async () => {
    const { all, finish } = steps({ send: async () => ({ ok: false, error: "Resend answered HTTP 500." }) });
    expect(await runWeeklyDigest(all, SUNDAY)).toMatchObject({ status: "failed", error: "Resend answered HTTP 500." });
    expect(finish).toHaveBeenCalledWith("run-1", { status: "failed", error: "Resend answered HTTP 500." });
  });

  it("marks the run failed without sending when the data can't load", async () => {
    const { all, finish, send } = steps({ load: async () => null });
    expect(await runWeeklyDigest(all, SUNDAY)).toMatchObject({ status: "failed" });
    expect(send).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
  });

  it("still frees the week when a step throws", async () => {
    const { all, finish } = steps({
      load: async () => {
        throw new Error("network");
      },
    });
    expect(await runWeeklyDigest(all, SUNDAY)).toMatchObject({ status: "failed" });
    expect(finish).toHaveBeenCalledWith("run-1", expect.objectContaining({ status: "failed" }));
  });

  it("doesn't send when the claim itself fails", async () => {
    const { all, send } = steps({ claim: async () => ({ error: "db down" }) });
    expect(await runWeeklyDigest(all, SUNDAY)).toEqual({ status: "failed", weekStart: "2026-11-16", error: "db down" });
    expect(send).not.toHaveBeenCalled();
  });
});
