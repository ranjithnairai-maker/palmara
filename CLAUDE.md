@AGENTS.md

# Palmistica

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

- **Three-call reading pipeline, one image analysis.** The palm photo is
  only ever sent to the vision model once:
  1. `POST /api/readings` — validates + stores the image, inserts a
     `readings` row (`status: 'processing'`), returns `{ id, ownerToken }`
     fast (~2s). `ownerToken` is returned **exactly once, here** — see the
     Manual Delete section below.
  2. `POST /api/readings/[id]/generate` — fired fire-and-forget by the
     client right after, and by the reading page's retry button. Calls the
     vision model once, parses its reply into `analysis_json`, then makes a
     second, **text-only** call (no image) that turns that JSON into the
     Quick Insights prose stored in `reading_text`. Sets `status:
     'complete'`. **Idempotent** — a no-op on an already-`complete` reading.
  3. `POST /api/readings/[id]/detailed` — triggered on demand by the
     "Reveal Your Full Reading" button. Text-only call (no image, no
     re-analysis) that expands `analysis_json` into `detailed_text`.
     **Idempotent** — returns the stored value without calling the model
     again if `detailed_text` already exists.
  This split exists because the free vision model can take well past a
  minute (especially the current default, `inclusionai/ling-3.0-flash-vl:free`,
  which reasons heavily — thousands of reasoning tokens — before emitting
  its actual answer), too close to Vercel's function timeout to do
  synchronously in the create request — and because Detailed Reading being
  optional means most readings never pay for that second text call at all.
  Don't collapse these back into fewer calls, and don't let Detailed
  re-send the image.
- **`lib/openrouter.ts`** wraps the Chat Completions call. It classifies
  errors as rate-limited by **pattern-matching the error text**, not just
  HTTP 429 — free-tier upstream providers return capacity errors as a
  200/502 with things like `"ResourceExhausted: ... limit reached"` in the
  body rather than a clean 429. If you see a new failure mode that's really
  "try again shortly," add its pattern to `looksLikeCapacityError()` rather
  than inventing a new error path. It also races the **entire**
  fetch-then-parse sequence (not just the initial `fetch()`) against the
  timeout — `fetch()` resolving only means headers arrived, and a stalled
  response body was once left completely unprotected, silently hanging
  until Vercel's own hard 60s kill fired instead of our friendly error.
  Every `maxTokens` value in this codebase is deliberately generous for the
  same reason: the current model spends a large share of its output budget
  on internal reasoning before the real answer, and too tight a cap
  silently truncates to empty content rather than an error you'd notice.
- **`lib/generateReading.ts` / `lib/parse.ts`** — `parseAnalysis()` parses
  the vision model's reply into `AnalysisJson` (per-line `traits` +
  `takeaway`, `mounts`); `parseDetailedReading()` parses the Detailed
  Reading model's reply into themed `DetailedSections`. Both are
  deliberately **tolerant**: `parseAnalysis` salvages whatever line data it
  can from malformed JSON rather than failing the whole reading, and
  `parseDetailedReading` returns `null` (never throws) on anything
  unparseable so the UI falls back to rendering the raw text as plain
  markdown. Keep both fallbacks if you touch this file — small/free models
  don't always follow strict JSON instructions. `parse.ts` imports
  `lib/openrouter.ts`, so it inherits that module's server-only rule (see
  Conventions) — never import it from a `"use client"` file; compute
  `detailedSections` server-side and pass it down via `ReadingPayload`
  instead (see the API routes and page Server Components for the pattern).
- **`lib/prompts.ts`** — the persona + guardrails (no medical/death/legal
  claims presented as fact, plus the warm/gentle/never-clinical voice
  requirement, plus a no-em-dash/grammar-correctness style block) live in
  `PALMISTICA_PERSONA`, shared by `ANALYSIS_SYSTEM`, `QUICK_INSIGHTS_SYSTEM`,
  `DETAILED_READING_SYSTEM`, and the chat prompt. Edit the shared block, not
  each prompt separately, or they'll drift. `buildChatSystemPrompt()`
  grounds every chat answer in the full `analysis_json` (and
  `detailed_text`, once generated) regardless of which tier the viewer is
  currently looking at — never let a chat answer say "reveal the full
  reading to see that."
- **`lib/sanitize-reading-text.ts`** — safety net behind the style block
  above: prompt instructions reduce but don't eliminate em-dash usage and
  grammar slips on a small/free model, so every generated text field
  (headline, per-line traits/takeaways, Quick Insights, Detailed Reading,
  chat replies) is run through `sanitizeReadingText()` once, at generation
  time, before it's stored — never on render. `lib/parse.ts`'s `str()`
  helper is the single choke point for analysis/detailed-reading fields;
  Quick Insights and chat replies (plain prose, not parsed JSON) are
  sanitized directly at their call sites in `lib/generateReading.ts` and
  `app/api/readings/[id]/messages/route.ts`. The heuristic is a simple
  word-count check, not real grammar parsing — worth eyeballing on real
  output rather than assuming it's perfect.
- **`ReadingView.tsx`** renders three top-level states (`processing` polls
  every 3s, `failed` offers retry via `/generate`, `complete` shows the
  tiered reading + chat) and is reused, with a `readOnly` prop, by both
  `/reading/[id]` (the creator's view) and `/r/[id]` (the public share view
  — same id, no chat input, no copy-link). There is no auth distinguishing
  these two routes — `readOnly` is just a UI mode, not a security boundary.
  Don't rely on it as one. Within the `complete` state: Quick Insights
  always renders; the Detailed section renders from `detailedSections` if
  present (falling back to raw `reading.detailed_text` as markdown if it
  didn't parse), otherwise a "Reveal Your Full Reading" CTA calls
  `/detailed`. `TipJar` (visible to everyone) and `DeleteReadingControl`
  (owner-only, checked via `localStorage`) are separate components composed
  in, not inlined — keep it that way if you touch this file, it's already
  large.
- **`lib/rateLimit.ts`** — Supabase-backed sliding-window rate limiter (no
  in-memory state; Vercel functions don't share memory across invocations).
  Every route that calls OpenRouter, writes to storage, or performs the
  owner-token delete must call `checkRateLimit(bucket, req)` before doing
  that work. See SECURITY.md for the bucket list and limits.
- **Manual delete (`DELETE /api/readings/[id]`)** — the only real
  authorization boundary in the app. `owner_token` (a `gen_random_uuid()`
  column) is returned once at creation, stashed client-side in
  `localStorage`, and compared server-side with `ownerTokenMatches()`
  (`lib/readings.ts`, timing-safe). A successful delete removes the stored
  image, inserts a row into `deleted_readings` (a tombstone — see below),
  then deletes the `readings` row (cascades to `reading_messages`).
- **`deleted_readings` tombstone.** The app can't tell "never existed" from
  "existed and was deleted" once a row is gone, but the UI needs to show a
  friendly "removed by its owner" message instead of a generic 404 for the
  latter. `isDeletedReading(id)` (`lib/readings.ts`) checks this table;
  both `/reading/[id]` and `/r/[id]` call it when `getReading()` returns
  null, before falling through to `notFound()`.
- **90-day image retention.** `pruneExpiredImages()` (`lib/readings.ts`),
  run daily by the Vercel Cron job defined in `vercel.json` hitting
  `GET /api/cron/prune-images` (protected by `CRON_SECRET` when set) —
  deletes the Storage object and clears `image_path` for any reading past
  the retention window, setting `image_deleted_at`. Never touches
  `analysis_json`, `reading_text`, `detailed_text`, or chat history — only
  the photo ages out. `ReadingView` checks `image_deleted_at` (not just a
  null `imageUrl`, which can also mean a transient fetch error) to decide
  whether to show the "aged out" placeholder vs. a generic "image
  unavailable" state.
- **Share-link preview images.** The analysis call also produces a
  `headline` (8-12 words, specific to that reading) stored in
  `analysis_json` — no extra API call. `app/r/[id]/opengraph-image.tsx`
  and `twitter-image.tsx` both call `renderReadingOgImage()` in
  `lib/og-image.tsx`, which does a **narrow** Supabase query
  (`getReadingOgData()` in `lib/readings.ts` — only `analysis_json`,
  `hand_element`, `status`, never the full row or the photo) and renders a
  branded 1200×630 `next/og` image from the headline — deliberately never
  the user's real photo, so it stays fast, doesn't leak a photo into a
  public link-preview context, and is unaffected by the 90-day photo
  prune. Font glyphs not covered by the loaded Playfair Display font
  (e.g. a unicode ✦) render as a blank box in `next/og`'s Satori renderer —
  there's no OS font-fallback like a browser has — so decorative marks in
  that file are inline SVG, not unicode symbols. If a reading id doesn't
  resolve to a complete reading (missing, still processing, or deleted),
  `renderReadingOgImage()` falls back to a generic branded "no longer
  available" image rather than erroring — a social crawler hitting a dead
  link should never see a broken preview. `generateMetadata` in
  `app/r/[id]/page.tsx` sets `title`/`description`/OpenGraph/Twitter tags
  from the same narrow query; it does **not** manually list `images` in
  `openGraph` — the `opengraph-image.tsx`/`twitter-image.tsx` file
  conventions in that same route segment are picked up automatically, and
  listing them again would duplicate. `/r/[id]` stays `noindex` throughout
  — that's independent of and doesn't conflict with rich share previews,
  it only affects search engines.

## Conventions

- Server-only code (`lib/supabase.ts`, `lib/readings.ts`, `lib/openrouter.ts`,
  `lib/rateLimit.ts`, `lib/og-image.tsx`) must only be imported by Route
  Handlers or Server Components — never anything `"use client"`. This is how
  the Supabase service role key and OpenRouter key stay out of the client
  bundle; verify it whenever you add a new import of these modules.
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
