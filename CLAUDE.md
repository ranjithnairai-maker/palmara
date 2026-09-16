@AGENTS.md

# Palmara

AI palm-reading web app. Upload/snap a palm photo → OpenRouter vision model
reads it grounded in real palmistry → follow-up chat → permanent shareable
link. **No user accounts, no login, by design.**

Full product context: [README.md](README.md). **Security rules — read
before touching secrets, `lib/`, or any API route:** [SECURITY.md](SECURITY.md).

## Stack (fixed, do not substitute)

Next.js 16 App Router + Tailwind v4 · Route Handlers on Vercel Serverless ·
OpenRouter (Chat Completions, server-side only) · Supabase (Postgres +
private Storage) · Vercel hosting. See `README.md` → Stack for why.

## Commands

```bash
npm run dev      # local dev, Turbopack
npm run build    # production build + typecheck (run this before considering any change done)
npm run lint      # eslint (flat config, Next 16 removed `next lint`)
```

No test suite exists yet. `npm run build` is the closest thing to CI — it
runs TypeScript and fails on any type error.

## Architecture

- **Two-phase reading creation**, not one blocking call:
  1. `POST /api/readings` — validates + stores the image, inserts a
     `readings` row (`status: 'processing'`), returns `{ id }` fast (~2s).
  2. `POST /api/readings/[id]/generate` — fired fire-and-forget by the
     client right after, and by the reading page's retry button. Does the
     slow OpenRouter vision call. **Idempotent** — safe to call again on a
     non-`complete` reading; a no-op on a `complete` one.
  This split exists because the free vision model can take 40–65s, which is
  too close to Vercel's function timeout to do synchronously in the create
  request. Don't collapse these back into one call.
- **`lib/openrouter.ts`** wraps the Chat Completions call. It classifies
  errors as rate-limited by **pattern-matching the error text**, not just
  HTTP 429 — the free model's upstream (Nvidia) returns capacity errors as a
  200/502 with `"ResourceExhausted: ... limit reached"` in the body. If you
  see a new failure mode that's really "try again shortly," add its pattern
  to `looksLikeCapacityError()` rather than inventing a new error path.
- **`lib/generateReading.ts` / `lib/parse.ts`** — parses the vision model's
  reply. The model is asked for a JSON envelope (`is_palm`, `hand_element`,
  `reading`, `clarification`) but `parse.ts` is deliberately tolerant of a
  model that ignores that contract and just returns markdown prose — it
  falls back to treating the whole cleaned reply as the reading. Keep that
  fallback if you touch this file; small/free models don't always follow
  strict JSON instructions.
- **`lib/prompts.ts`** — the persona + guardrails (no medical/death/legal
  claims presented as fact) live in `PALMARA_PERSONA`, shared by both the
  initial reading prompt and the follow-up chat prompt. Edit the shared
  block, not each prompt separately, or the two will drift.
- **`ReadingView.tsx`** renders three states (`processing` polls every 3s,
  `failed` offers retry via `/generate`, `complete` shows reading + chat) and
  is reused, with a `readOnly` prop, by both `/reading/[id]` (the creator's
  view) and `/r/[id]` (the public share view — same id, no chat input, no
  copy-link). There is no auth distinguishing these two routes — `readOnly`
  is just a UI mode, not a security boundary. Don't rely on it as one.
- **`lib/rateLimit.ts`** — Supabase-backed sliding-window rate limiter (no
  in-memory state; Vercel functions don't share memory across invocations).
  Every route that calls OpenRouter or writes to storage must call
  `checkRateLimit(bucket, req)` before doing that work. See SECURITY.md for
  the bucket list and limits.

## Conventions

- Server-only code (`lib/supabase.ts`, `lib/readings.ts`, `lib/openrouter.ts`,
  `lib/rateLimit.ts`) must only be imported by Route Handlers or Server
  Components — never anything `"use client"`. This is how the Supabase
  service role key and OpenRouter key stay out of the client bundle; verify
  it whenever you add a new import of these modules.
- API errors returned to the client are short, hand-written, in-voice
  strings ("The reader lost the thread there…") — never `err.message` from
  a caught exception unless you wrote that message yourself as validation
  feedback. Log the real error with `console.error` instead.
- Route params are validated with `isUuid()` before any DB query.
- Tone/copy follows `lib/prompts.ts`'s persona even in UI strings (loading
  states, error messages) — warm, a little mystical, never fatalistic.
- Design tokens live in `app/globals.css` (`@theme` block) — the palette,
  fonts, and named animations (`glow-pulse`, `star-drift`, `candle-flicker`,
  `trace-line`) are there, not hardcoded per-component.

## Before shipping any change here

Run through SECURITY.md's "Before Every Commit" checklist — it's short and
specific to this repo (no hardcoded secrets, new routes have rate limiting +
validation, no service role key in client code, no raw error/user-content
logging). Then `npm run build`.
