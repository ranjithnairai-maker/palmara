# Palmara

A small, polished web app for AI palm readings grounded in real palmistry. Upload
or snap a photo of your palm, get a reading of your hand's element and the four
major lines, ask follow-up questions, and share the result via a permanent
unguessable link. No accounts.

## Stack

- **Next.js (App Router)** + **Tailwind CSS v4** — front end
- **Next Route Handlers** — API, deployed as Vercel Serverless Functions
- **OpenRouter** (OpenAI-compatible Chat Completions) — vision + chat, server-side only
- **Supabase** — Postgres for readings/messages, private Storage bucket for images
- **Vercel** — hosting

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Where to get it |
| --- | --- |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `OPENROUTER_MODEL` | Any image-capable model id from https://openrouter.ai/models. Default `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` (free, multimodal, slow). Swap to a paid vision model — e.g. `google/gemini-2.0-flash-001` — with no code changes. |
| `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role`. **Server-side only. Never expose to the client.** |
| `NEXT_PUBLIC_SITE_URL` | Optional. Canonical origin for absolute share links (e.g. `https://palmara.vercel.app`). Falls back to the Vercel URL, then the request host. |
| `RATE_LIMIT_SALT` | Optional. Salts the IP hash used for rate limiting (`lib/rateLimit.ts`) so it can't be reversed even with DB read access. Any random string; has a safe built-in default if unset. |
| `CRON_SECRET` | Optional but recommended. Vercel sends this as `Authorization: Bearer <value>` when it triggers the daily image-retention job; set it in Vercel too so the job can't be triggered by anyone who finds the URL. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional. Shown in the footer as a fallback for anyone who lost the browser (and localStorage token) that created a reading and needs it removed manually. Omit to hide that line. |
| `NEXT_PUBLIC_TIP_LINK_1` / `_3` / `_5` | Optional. Stripe Payment Link URLs for the $1/$3/$5 support buttons (plain outbound links — no checkout code, no webhooks, no payment data ever touches this app). The tip strip only renders if at least one is set. |

### Database schema

Run `supabase/schema.sql` against your project (or use the Supabase SQL editor).
It creates the `readings`, `reading_messages`, `rate_limit_hits`, and
`deleted_readings` tables with RLS enabled and **no policies** — every
read/write goes through the service role key on the server. Also create a
**private** Storage bucket named `palm-photos`.

## How it works

1. **`POST /api/readings`** — validates the compressed base64 image, uploads it to
   the `palm-photos` bucket, inserts a `readings` row (`status: 'processing'`),
   returns `{ id, ownerToken }` immediately. `ownerToken` is returned exactly
   once — the client stashes it in `localStorage` so it can delete the reading
   later (see Manual delete, below).
2. **`POST /api/readings/[id]/generate`** — fired by the client without blocking
   navigation. Downloads the stored image and calls the OpenRouter vision model
   **once**, parsing its reply into structured `analysis_json` (hand element,
   and traits + a takeaway for each of the four major lines). A second,
   text-only call then turns that JSON into the **Quick Insights** reading
   (`reading_text`) the user sees first. Sets `status: 'complete'`, or
   `'failed'` on error. The model call is aborted at 55s so a slow reading
   always resolves to a retryable failed state rather than hanging.
3. **`/reading/[id]`** — shows the palm photo, Quick Insights, and a "Reveal
   Your Full Reading" button; polls while processing; hosts the follow-up chat.
4. **`POST /api/readings/[id]/detailed`** — triggered by that button. A
   third, text-only call (no image, no re-analysis) expands `analysis_json`
   into the longer, themed **Detailed Reading** (`detailed_text`) — Vitality,
   Love, Mind, and Path. Idempotent: generated once per reading, then just
   returned.
5. **`POST /api/readings/[id]/messages`** — answers follow-ups grounded in the
   full `analysis_json` (and `detailed_text`, once generated) regardless of
   which tier the viewer is currently looking at, plus recent chat turns.
6. **`/r/[id]`** — the same reading, read-only, for sharing. Also visible here
   (and on `/reading/[id]`): a quiet, always-shown tip strip (Stripe Payment
   Links, if configured), and — only in the browser that created the
   reading — a "Delete this reading" control at the very bottom.
7. **Manual delete** — `DELETE /api/readings/[id]` requires the `owner_token`
   from step 1 in the request body and rejects with 403 on any mismatch. On
   success it removes the stored photo, tombstones the id in
   `deleted_readings` (so the link later shows a friendly "removed by its
   owner" message instead of a bare 404), and deletes the `readings` row
   (cascading to its messages).
8. **90-day image retention** — a daily Vercel Cron job (`vercel.json` →
   `GET /api/cron/prune-images`) deletes the stored photo for any reading
   older than 90 days and clears `image_path`. Everything else — the
   analysis, Quick Insights, Detailed Reading, and chat history — is kept
   indefinitely; only the original photo ages out.

## Security

Palmara has no accounts — see [SECURITY.md](SECURITY.md) for the full rules
this project follows and how "access control" is adapted for a no-login app
(short version: unguessable UUIDs, per-IP rate limiting on every endpoint
that costs money or storage, a timing-safe `owner_token` check as the one
real authorization boundary for deletion, private Storage bucket + signed
URLs, RLS with no policies on every table, security headers + CSP, and no
secrets or raw error detail ever reaching the client). Read it before adding
a new route or touching anything under `lib/`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → Import** the repo (framework auto-detects as Next.js).
3. Add the environment variables above under **Settings → Environment
   Variables** (Production + Preview).
4. Deploy.

> The initial reading route needs up to ~60s on the free model. Vercel Hobby caps
> serverless functions at 60s; a paid vision model returns in a few seconds and
> removes the risk entirely. On Pro you can raise `maxDuration` in the route files.

`vercel.json` defines a daily Cron job for image retention — Vercel's Hobby
plan allows one run per day per cron, which matches the schedule here, so no
plan change is needed. Set `CRON_SECRET` (Production) so that endpoint isn't
publicly triggerable. To enable the tip strip, create three Stripe Payment
Links ($1/$3/$5) and set `NEXT_PUBLIC_TIP_LINK_1/_3/_5`.

### Nice-to-haves (not built)

Suggested-question chips beyond the default static set — e.g. generated
per-reading from `analysis_json` rather than the same five questions for
everyone. (Rate limiting and image retention were on this list originally —
both are now built, see Security above and "How it works.")
