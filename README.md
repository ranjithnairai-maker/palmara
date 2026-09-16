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

### Database schema

Run `supabase/schema.sql` against your project (or use the Supabase SQL editor).
It creates the `readings`, `reading_messages`, and `rate_limit_hits` tables with
RLS enabled and **no policies** — every read/write goes through the service role
key on the server. Also create a **private** Storage bucket named `palm-photos`.

## How it works

1. **`POST /api/readings`** — validates the compressed base64 image, uploads it to
   the `palm-photos` bucket, inserts a `readings` row (`status: 'processing'`),
   returns `{ id }` immediately.
2. **`POST /api/readings/[id]/generate`** — fired by the client without blocking
   navigation. Downloads the stored image, calls the OpenRouter vision model with
   the Palmara system prompt, parses the structured reply, and persists the
   reading + first assistant message (`status: 'complete'`), or `status: 'failed'`
   on error. The model call is aborted at 55s so a slow reading always resolves to
   a retryable failed state rather than hanging.
3. **`/reading/[id]`** — shows the palm photo + sectioned reading, polls while
   processing, and hosts the follow-up chat.
4. **`POST /api/readings/[id]/messages`** — answers follow-ups using the original
   reading text as context (no image re-send) plus recent chat turns.
5. **`/r/[id]`** — the same reading, read-only, for sharing.

## Security

Palmara has no accounts — see [SECURITY.md](SECURITY.md) for the full rules
this project follows and how "access control" is adapted for a no-login app
(short version: unguessable UUIDs, per-IP rate limiting on every endpoint
that costs money or storage, private Storage bucket + signed URLs, RLS with
no policies on every table, security headers + CSP, and no secrets or raw
error detail ever reaching the client). Read it before adding a new route or
touching anything under `lib/`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → Import** the repo (framework auto-detects as Next.js).
3. Add the environment variables above under **Settings → Environment
   Variables** (Production + Preview).
4. Deploy.

> The initial reading route needs up to ~60s on the free model. Vercel Hobby caps
> serverless functions at 60s; a paid vision model returns in a few seconds and
> removes the risk entirely. On Pro you can raise `maxDuration` in the route files.

### Nice-to-haves (not built)

A Vercel Cron job to prune readings/images past a retention window, and
suggested-question chips beyond the default set. (Rate limiting was on this
list originally — it's now built, see Security above.)
