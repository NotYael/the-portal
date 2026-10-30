/**
 * Gemini over its REST API, with model fallback (server only).
 *
 * GEMINI_MODELS is tried in order. A model that times out, is rate-limited
 * (429), missing (404), rejects the request (400) or returns JSON that fails
 * validation hands over to the next one; a 5xx gets one retry first. The
 * model that answered moves to the front for later requests. Only when every
 * model fails does the caller fall back to its non-AI version.
 *
 * Requests ask for low thinking: the Flash models answer in ~2–4s instead of
 * 10–15s+. A model that rejects that setting (400) is retried once without it.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash-lite"];
const ATTEMPT_TIMEOUT_MS = 15_000;
/** All models share this, so the page never waits much longer; each model left gets an equal part. */
const TOTAL_BUDGET_MS = 40_000;
const RETRY_DELAY_MS = 1_000;

/** not_configured: no API key. busy: rate-limited. unavailable: every model failed. */
export type AiFailure = "not_configured" | "busy" | "unavailable";
export type AiResult<T> = { ok: true; data: T; model: string } | { ok: false; reason: AiFailure };

export interface GenerateRequest<T> {
  system: string;
  prompt: string;
  /** Gemini `responseSchema` (OpenAPI subset: OBJECT, ARRAY, STRING, NUMBER…). */
  responseSchema: object;
  /** Validates and cleans the model's JSON. Return null (or throw) to reject it and try the next model. */
  accept: (raw: unknown) => T | null;
  temperature?: number;
  /** Gemini 3 thinkingLevel; null sends no thinking settings. Default "low". */
  thinking?: "minimal" | "low" | "medium" | "high" | null;
}

/** Injectable for tests. */
export interface GeminiDeps {
  apiKey: string | undefined;
  models: string[];
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  log: (message: string) => void;
}

/** GEMINI_MODELS (comma-separated), else the spec's single GEMINI_MODEL, else the defaults. */
export function configuredModels(env: Record<string, string | undefined> = process.env): string[] {
  const list = (env.GEMINI_MODELS || env.GEMINI_MODEL || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : DEFAULT_MODELS;
}

/** Splits the time left between this model and the ones after it, so a slow model can't starve the rest. */
export function attemptTimeout(leftMs: number, modelsLeft: number): number {
  return Math.min(ATTEMPT_TIMEOUT_MS, Math.floor(leftMs / Math.max(1, modelsLeft)));
}

let lastGood: string | null = null;

/** The configured models, with the one that last answered first. */
function inOrder(models: string[]): string[] {
  return lastGood && models.includes(lastGood) ? [lastGood, ...models.filter((m) => m !== lastGood)] : models;
}

/** For tests: forget which model answered last. */
export function resetModelPreference() {
  lastGood = null;
}

type Attempt<T> =
  | { kind: "ok"; data: T }
  | { kind: "retry"; why: string; plain?: boolean }
  | { kind: "next"; why: string; busy?: boolean }
  | { kind: "stop"; why: string };

export async function generateJson<T>(request: GenerateRequest<T>, overrides: Partial<GeminiDeps> = {}): Promise<AiResult<T>> {
  const deps: GeminiDeps = {
    apiKey: process.env.GEMINI_API_KEY,
    models: configuredModels(),
    fetch: globalThis.fetch,
    now: Date.now,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: (message) => console.warn(message),
    ...overrides,
  };
  if (!deps.apiKey) return { ok: false, reason: "not_configured" };

  const thinking = request.thinking === undefined ? "low" : request.thinking;
  const body = (withThinking: boolean) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: request.responseSchema,
        temperature: request.temperature ?? 0.2,
        ...(withThinking && thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
      },
    });
  const deadline = deps.now() + TOTAL_BUDGET_MS;
  let busy = false;

  const models = inOrder(deps.models);
  for (const [index, model] of models.entries()) {
    let withThinking = Boolean(thinking);
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - deps.now();
      if (left < 1_000) {
        deps.log(`[gemini] out of time before trying ${model}`);
        return { ok: false, reason: busy ? "busy" : "unavailable" };
      }
      const result = await callModel(model, body(withThinking), withThinking, attemptTimeout(left, models.length - index), request.accept, deps);
      if (result.kind === "ok") {
        lastGood = model;
        return { ok: true, data: result.data, model };
      }
      if (result.kind === "stop") {
        deps.log(`[gemini] ${model}: ${result.why}; not trying other models`);
        return { ok: false, reason: "unavailable" };
      }
      if (result.kind === "retry" && attempt === 0) {
        deps.log(`[gemini] ${model}: ${result.why}; retrying once${result.plain ? " without thinking settings" : ""}`);
        if (result.plain) withThinking = false;
        else await deps.sleep(RETRY_DELAY_MS);
        continue;
      }
      if (result.kind === "next" && result.busy) busy = true;
      deps.log(`[gemini] ${model}: ${result.why}; trying the next model`);
      break;
    }
  }
  return { ok: false, reason: busy ? "busy" : "unavailable" };
}

async function callModel<T>(
  model: string,
  body: string,
  withThinking: boolean,
  timeoutMs: number,
  accept: (raw: unknown) => T | null,
  deps: GeminiDeps,
): Promise<Attempt<T>> {
  let res: Response;
  try {
    res = await deps.fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": deps.apiKey! },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "error";
    return { kind: "next", why: name === "TimeoutError" ? `no answer in ${timeoutMs / 1000}s` : `unreachable (${name})` };
  }

  // A bad or revoked key fails the same way on every model.
  if (res.status === 401 || res.status === 403) return { kind: "stop", why: `HTTP ${res.status} (check GEMINI_API_KEY)` };
  if (res.status === 429) return { kind: "next", why: "rate-limited (429)", busy: true };
  if (res.status >= 500) return { kind: "retry", why: `HTTP ${res.status}` };
  // Models differ in which thinking levels they take; a 400 may be just that.
  if (res.status === 400 && withThinking) return { kind: "retry", why: "HTTP 400", plain: true };
  if (!res.ok) return { kind: "next", why: `HTTP ${res.status}` };

  let text: string;
  try {
    const payload = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: unknown; thought?: boolean }[] }; finishReason?: string }[];
    };
    const candidate = payload.candidates?.[0];
    text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
    if (!text) return { kind: "next", why: `empty answer (${candidate?.finishReason ?? "no candidates"})` };
  } catch (error) {
    const name = error instanceof Error ? error.name : "error";
    return { kind: "next", why: name === "TimeoutError" ? `no answer in ${timeoutMs / 1000}s` : "unreadable response" };
  }

  let data: T | null;
  try {
    data = accept(JSON.parse(text));
  } catch {
    data = null;
  }
  return data === null ? { kind: "next", why: "answer failed validation" } : { kind: "ok", data };
}
