# Security Rules — Always Follow These

This file is the security contract for Palmistica. It's written to be read by
both humans and Claude Code before any change that touches secrets, data
access, or user input. If a change conflicts with something here, the
change is wrong until this file is updated on purpose — not the other way
around.

> **A note on scope, read first:** Palmistica has **no user accounts, no login,
> and no admin role** — that's a deliberate product decision (see
> [README.md](README.md)), not an oversight. A reading is a public,
> unguessable-URL resource (`/r/[id]`, `/reading/[id]`), like a Google Doc
> shared "anyone with the link." So the sections below that talk about
> "authentication" and "access control" are adapted to what that actually
> means here: **no session-based auth to bypass, but real abuse and
> data-exposure risks to guard against anyway.** Where a rule as originally
> written assumes accounts exist, the adapted version follows immediately
> after it in *italics*.

## Secrets & API Keys

- NEVER hardcode API keys, tokens, or secrets in code.
- ALL secrets must use environment variables (`process.env.VARIABLE_NAME`).
- The `.env*` files must always be in `.gitignore` (`.env.example` is the
  one intentional exception — it holds no real values).
- The Supabase `service_role` key must NEVER appear in any client-side or
  frontend code — server-side only.

**How this is enforced in Palmistica:**
- `lib/supabase.ts` is the only module that reads `SUPABASE_SERVICE_ROLE_KEY`,
  and it is imported exclusively by Route Handlers (`app/api/**/route.ts`)
  and Server Components (`app/reading/[id]/page.tsx`, `app/r/[id]/page.tsx`)
  — never by anything marked `"use client"`. Before adding a new import of
  `lib/supabase.ts` or `lib/readings.ts`, confirm the importing file is
  server-only.
- `OPENROUTER_API_KEY` is read only inside `lib/openrouter.ts`, called only
  from Route Handlers.
- `.gitignore` excludes `.env*` with `!.env.example` carved out.
- `.env.example` documents every variable name with **no real values**.

## Authentication & Access Control

- Every API route must verify authentication before processing requests.
  *Adapted: Palmistica has no auth to check — every route is intentionally
  public. Instead, every route validates its inputs (UUID shape, image
  type/size, question length) and is rate-limited (see below) before doing
  any expensive or storage-writing work.*
- Admin features must check for admin role, not just that the user is
  logged in. *Adapted: there are no admin features or roles in this app. If
  one is ever added (e.g. a moderation/delete endpoint), it must be gated by
  something stronger than "knows a URL" — a real auth check, not a shared
  secret in a query string.*
- Never trust user-supplied IDs without verifying the requesting user
  actually owns that resource. *Adapted: there is no ownership model —
  anyone who has a reading's id can view it and continue its chat, exactly
  like a shared-link doc. That's the product. What Palmistica does verify: the
  id is a well-formed UUID (`isUuid()`) before it ever reaches a database
  query, and every read goes through parameterized Supabase client calls
  (`.eq("id", id)`), never string-built SQL.*
- Logged-out users must not be able to reach any authenticated content.
  *Adapted: N/A — there is no authenticated content by design.*

**What actually protects this app, given no accounts:**
1. **Unguessability.** Reading ids are `gen_random_uuid()` (v4) — 122 bits
   of randomness. Not brute-forceable.
2. **Rate limiting** (`lib/rateLimit.ts`), enforced server-side per hashed
   client IP, on every endpoint that costs money, storage, or is otherwise
   abusable:
   - `POST /api/readings` (create): 5/min, 20/hour
   - `POST /api/readings/[id]/generate` (the OpenRouter vision call — the
     expensive one, run once per reading): 4/min, 15/hour
   - `POST /api/readings/[id]/detailed` (text-only, on demand, idempotent
     once generated): 4/min, 20/hour
   - `POST /api/readings/[id]/messages` (chat): 10/min, 60/hour
   - `DELETE /api/readings/[id]` (no OpenRouter cost, but the one
     irreversible write in the app, gated only by `owner_token` — rate
     limiting is defense-in-depth against token guessing): 6/min, 20/hour
   Limits fail **open** on an infra error (a rate-limit outage should never
   block a real user), and store a **salted SHA-256 hash** of the IP, never
   the raw address.
3. **Private storage.** The `palm-photos` bucket is private; images are only
   ever served via short-lived (1h) signed URLs generated server-side.
4. **RLS with no policies** on every table (`readings`, `reading_messages`,
   `rate_limit_hits`, `deleted_readings`) — the anon/publishable key can do
   nothing; all access is via the service role key inside Route Handlers.
5. **Owner-token deletion**, the app's one real authorization boundary.
   There are no accounts, so a reading's `owner_token` (a `gen_random_uuid()`,
   returned exactly once, in the `POST /api/readings` response) is what
   proves the request to delete it came from its creator. It's compared with
   `ownerTokenMatches()` (`lib/readings.ts`) using `crypto.timingSafeEqual`
   over SHA-256 digests of both sides, not a plain `===`, so response timing
   can't be used to narrow a guess. The client stashes it in `localStorage`;
   losing that storage means losing the ability to self-delete, by design —
   there's a footer contact link as the manual fallback.

## Code Quality & Safety

- Never log full user objects or sensitive data to the console.
  *There are no user objects. Server logs (`console.error`) are limited to
  short diagnostic strings — an HTTP status, an upstream error class — never
  full request bodies, images, or chat content.*
- Never show stack traces or raw error messages to end users. Every API
  route returns a short, deliberately-written user-facing message on
  failure; the real error (exception, Supabase/OpenRouter error detail)
  goes to `console.error` only. If you add a new `catch` block, follow this
  pattern — don't do `error: err.message` for anything that isn't a message
  you wrote yourself for validation.
- Always validate and sanitize user input before using it in queries.
  - Route params are checked with `isUuid()` before any DB call.
  - The uploaded image is checked for a `data:image/(jpeg|png|webp);base64,`
    shape, decoded, and size-capped (min 1KB, max 8MB) before it's ever
    written to storage or sent to the model.
  - Chat questions are length-capped (1000 chars) and trimmed.
  - All database access goes through the Supabase JS client's parameterized
    query builder (`.eq()`, `.insert()`, …) — never raw/concatenated SQL.
- Keep dependencies up to date — flag any package more than 2 major
  versions behind. Current status (`npm outdated`, checked at each security
  pass): `typescript` is 2 majors behind (5.9 installed vs 7.0 latest) —
  flagged, not auto-upgraded, since a 2-major TS bump risks new compiler
  errors that need a dedicated pass to verify safely. Everything else
  (`next`, `react`, `eslint-config-next`) is at most a patch/minor behind.
  `npm audit` reports 0 known vulnerabilities as of the last check.

## OWASP Top 10 — current posture

Reviewed against the OWASP Top 10 (2021). New features should re-check this
list, not just add code.

| Risk | Status here |
| --- | --- |
| A01 Broken Access Control | No accounts by design; mitigated by unguessable UUIDs + rate limiting (see above). The one exception — deleting a reading — is gated by a timing-safe `owner_token` comparison, the app's real authorization boundary; the "hidden unless your browser has the token" UI is cosmetic, not the enforcement. Every write validates the target row exists and is in the expected state before acting on it. |
| A02 Cryptographic Failures | No passwords or payment data stored. Secrets are env-var only. IPs are hashed, not stored raw, in the rate-limit table. All traffic is HTTPS (enforced by Vercel + HSTS header). |
| A03 Injection | All DB access via the Supabase client's parameterized builder — no string-built SQL anywhere in the app. User content rendered in chat is either plain-text (`<p>{content}</p>`, React-escaped) or passed through `react-markdown` **without** `rehype-raw`, so raw HTML/script in a message can't execute. |
| A04 Insecure Design | Reading generation is idempotent and re-entrant (safe to retry); failures degrade to a retryable `failed` status rather than a stuck or duplicated state. |
| A05 Security Misconfiguration | `next.config.ts` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and a `Content-Security-Policy` on every response. **Known relaxation:** the CSP allows `'unsafe-inline'` on `script-src` because Next.js injects inline hydration data without a nonce set up here — documented, not accidental. Storage bucket is private, not public. |
| A06 Vulnerable & Outdated Components | See dependency note above; `npm audit` clean. |
| A07 Identification & Auth Failures | No auth subsystem exists to fail. |
| A08 Software & Data Integrity Failures | No CI/CD signing in scope for this project size; dependencies installed from the public npm registry via lockfile (`package-lock.json` is committed). |
| A09 Security Logging & Monitoring Failures | Errors are logged server-side with enough context to debug (status codes, upstream error class) without leaking user content; Vercel's own request/runtime logs cover the rest. No dedicated alerting is set up — acceptable for this app's size, revisit if traffic grows. |
| A10 Server-Side Request Forgery | The only outbound server call with a variable component is to OpenRouter with a **server-constructed** data URL (the image the app itself just uploaded) — never a user-supplied URL. No endpoint accepts an arbitrary URL to fetch. |

## Before Every Commit

Check, in order:

1. **No hardcoded secrets anywhere in the codebase.** Search the diff for
   anything that looks like a key (`sk-`, `eyJ...` JWTs, etc.) before
   staging. `.env.local` must never be `git add`-ed (it's gitignored, but
   double-check `git status` if you ever touched that file).
2. **All new API routes have the checks this app actually uses:** input
   validation (`isUuid`, size/type/length caps) and, if the route calls
   OpenRouter or writes to storage, a `checkRateLimit(...)` call.
3. **No `service_role` key in any client-side code.** If a new file imports
   `lib/supabase.ts` or `lib/readings.ts`, confirm it has no `"use client"`
   directive and isn't imported by one.
4. **No new `console.log`/`console.error` containing full request bodies,
   images, or raw upstream error payloads** — short diagnostic strings only.
