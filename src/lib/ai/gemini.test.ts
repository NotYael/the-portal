import { beforeEach, describe, expect, it } from "vitest";
import { attemptTimeout, configuredModels, generateJson, resetModelPreference, type GeminiDeps } from "./gemini";

const answer = (json: unknown, extraParts: object[] = []) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [...extraParts, { text: JSON.stringify(json) }] } }] }), {
    status: 200,
  });

const timeout = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

type Step = Response | Error;

/** A fake fetch that plays one step per call, in order, and records which model each call hit. */
function fake(steps: Step[], clock = { t: 0 }, costMs = 0) {
  const calls: string[] = [];
  const thinking: boolean[] = [];
  const logs: string[] = [];
  const deps: Partial<GeminiDeps> = {
    apiKey: "test-key",
    models: ["m1", "m2", "m3"],
    now: () => clock.t,
    sleep: async (ms) => {
      clock.t += ms;
    },
    log: (m) => logs.push(m),
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url).split("/models/")[1].split(":")[0]);
      thinking.push(Boolean(JSON.parse(String(init?.body)).generationConfig.thinkingConfig));
      clock.t += costMs;
      const step = steps.shift();
      if (!step) throw new Error("no more steps");
      if (step instanceof Error) throw step;
      return step;
    }) as typeof fetch,
  };
  return { deps, calls, thinking, logs };
}

const request = {
  system: "s",
  prompt: "p",
  responseSchema: { type: "OBJECT" },
  accept: (raw: unknown) => {
    const v = raw as { n?: unknown };
    return typeof v?.n === "number" ? v.n : null;
  },
};

beforeEach(() => resetModelPreference());

describe("generateJson", () => {
  it("returns the first model's answer", async () => {
    const { deps, calls } = fake([answer({ n: 1 })]);
    expect(await generateJson(request, deps)).toEqual({ ok: true, data: 1, model: "m1" });
    expect(calls).toEqual(["m1"]);
  });

  it("moves to the next model on a timeout, 429, 404 or bad JSON", async () => {
    const { deps, calls } = fake([timeout(), new Response("", { status: 429 }), new Response("", { status: 404 }), answer({ n: 2 })]);
    deps.models = ["m1", "m2", "m3", "m4"];
    expect(await generateJson(request, deps)).toMatchObject({ ok: true, data: 2, model: "m4" });
    expect(calls).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("rejects answers that fail validation and asks the next model", async () => {
    const { deps, calls } = fake([answer({ n: "nope" }), answer({ n: 3 })]);
    expect(await generateJson(request, deps)).toMatchObject({ ok: true, data: 3, model: "m2" });
    expect(calls).toEqual(["m1", "m2"]);
  });

  it("retries a 5xx once on the same model before moving on", async () => {
    const { deps, calls } = fake([new Response("", { status: 503 }), new Response("", { status: 503 }), answer({ n: 4 })]);
    expect(await generateJson(request, deps)).toMatchObject({ ok: true, model: "m2" });
    expect(calls).toEqual(["m1", "m1", "m2"]);
  });

  it("asks for low thinking, and retries a model without it when it rejects the setting", async () => {
    const { deps, calls, thinking } = fake([new Response("", { status: 400 }), answer({ n: 6 })]);
    expect(await generateJson(request, deps)).toMatchObject({ ok: true, data: 6, model: "m1" });
    expect(calls).toEqual(["m1", "m1"]);
    expect(thinking).toEqual([true, false]);
  });

  it("moves on when a model rejects the request even without thinking settings", async () => {
    const { deps, calls } = fake([new Response("", { status: 400 }), new Response("", { status: 400 }), answer({ n: 7 })]);
    expect(await generateJson(request, deps)).toMatchObject({ ok: true, model: "m2" });
    expect(calls).toEqual(["m1", "m1", "m2"]);
  });

  it("skips thought parts and reads the answer text", async () => {
    const { deps } = fake([answer({ n: 5 }, [{ text: "thinking…", thought: true }])]);
    expect(await generateJson(request, deps)).toMatchObject({ ok: true, data: 5 });
  });

  it("starts with the model that answered last time", async () => {
    const first = fake([timeout(), answer({ n: 1 })]);
    await generateJson(request, first.deps);
    const second = fake([answer({ n: 2 })]);
    await generateJson(request, second.deps);
    expect(second.calls).toEqual(["m2"]);
  });

  it("reports busy when every model is rate-limited", async () => {
    const { deps } = fake([new Response("", { status: 429 }), new Response("", { status: 429 }), new Response("", { status: 429 })]);
    expect(await generateJson(request, deps)).toEqual({ ok: false, reason: "busy" });
  });

  it("stops at once on a bad API key", async () => {
    const { deps, calls } = fake([new Response("", { status: 403 })]);
    expect(await generateJson(request, deps)).toEqual({ ok: false, reason: "unavailable" });
    expect(calls).toEqual(["m1"]);
  });

  it("gives up when the time budget runs out", async () => {
    // Each call burns 20s, past its share: after m2 there's no time left for m3.
    const { deps, calls } = fake([timeout(), timeout(), answer({ n: 1 })], { t: 0 }, 20_000);
    expect(await generateJson(request, deps)).toEqual({ ok: false, reason: "unavailable" });
    expect(calls).toEqual(["m1", "m2"]);
  });

  it("does nothing without an API key", async () => {
    const { deps, calls } = fake([]);
    deps.apiKey = undefined;
    expect(await generateJson(request, deps)).toEqual({ ok: false, reason: "not_configured" });
    expect(calls).toEqual([]);
  });
});

describe("attemptTimeout", () => {
  it("shares the 40s budget so every model gets a turn, capped at 15s each", () => {
    expect(attemptTimeout(40_000, 3)).toBe(13_333);
    expect(attemptTimeout(40_000 - 13_333, 2)).toBe(13_333);
    expect(attemptTimeout(13_334, 1)).toBe(13_334);
    expect(attemptTimeout(40_000, 1)).toBe(15_000);
  });
});

describe("configuredModels", () => {
  it("reads GEMINI_MODELS, then GEMINI_MODEL, then the defaults", () => {
    expect(configuredModels({ GEMINI_MODELS: " a, b ,a,, c" })).toEqual(["a", "b", "c"]);
    expect(configuredModels({ GEMINI_MODEL: "solo" })).toEqual(["solo"]);
    expect(configuredModels({}).length).toBeGreaterThan(1);
  });
});
