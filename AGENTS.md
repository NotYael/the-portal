<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## The Portal — project notes

- Spec: `docs/PORTAL_SPEC.md` (copied from the shared guide). The spec says Angular; this repo is Next.js by the owner's choice — see "Differences from the spec" in `README.md`. Follow the spec's working agreement: one phase at a time, ask before destructive, architectural or paid changes.
- Status: login (`src/lib/supabase/*`, `src/proxy.ts`), expenses (`src/lib/data/expense-book.ts`), jobs (`src/lib/data/job-board.ts`) and reminders (`src/lib/data/reminders.ts`, date math in `src/lib/reminders.ts`) run on Supabase (project ref `dpbioilargqxniuhdvfw`); goals, journal and profile still run on mock data (`src/lib/data/store.ts`, localStorage). Without `NEXT_PUBLIC_SUPABASE_*` in `.env.local` everything is demo mode. AI routes and crons come next.
- Money on screen goes through `peso` / `pesoExact` / `compactPeso` in `src/lib/format.ts`: they return `*******` while "Hide amounts" is on (`src/lib/privacy.ts`). Never format pesos another way, and lock any UI that shows amounts in inputs (settings, edit drawer) while it's on.
- Gemini: every call goes through `generateJson` in `src/lib/ai/gemini.ts`, never a direct fetch. The owner wants model fallback: `GEMINI_MODELS` is tried in order, a timeout/400/404/429/5xx/invalid answer moves on, and the non-AI fallback only runs when every model fails. Keep `thinkingLevel: "low"` unless a feature needs more (default thinking took 10–15 s+ and timed out). Prompts, payload builders and validators live in `src/lib/ai/expense-ai.ts` (tested); the routes only wire them up.
- Migrations: `supabase/migrations/<version>_<name>.sql`, named with the versions recorded on the remote project. Every table revokes all from `anon`/`authenticated` before granting (this project still auto-grants new tables). After a schema change, run the Supabase advisors and regenerate `src/lib/database.types.ts`.
- `cacheComponents` is on: data-driven client components render a skeleton until `usePortalData()` / `useToday()` return non-null, so nothing reads `Date` or `localStorage` during prerender. `useSearchParams` needs a `<Suspense>` boundary (see `src/app/(portal)/expenses/page.tsx`).
- Money math lives in `src/lib/expense-stats.ts` as pure functions with tests (`npm test`). Never compute stats from month indexes; use `spent_on` dates in Asia/Manila (`src/lib/dates.ts`).
- Tokens: `src/styles/tokens.css` and `src/lib/theme.ts` must stay in sync, for both the light and the dark palette. Dark mode (`src/lib/color-scheme.ts`) flips tokens on `<html data-theme>`, so `--ink` turns light: put `text-on-ink` on a `bg-ink` fill, use `bg-panel` for dark panels that stay dark, and give charts their colors from `useChartTheme()` plus `key={theme}`. Don't pass a `className` that fights a component's own Tailwind classes (same property); add a prop or variant instead.
- react-chartjs-2 registers plugins once per chart: if a plugin closes over props, give the chart a `key` that changes with them.
