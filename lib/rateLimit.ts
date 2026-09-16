import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase";

/**
 * Server-side rate limiting for Palmara's public, unauthenticated API.
 * There are no accounts here (by design — see README), so the only access
 * control available is "how often has this client hit this endpoint" —
 * this is that check.
 *
 * Backed by a small Supabase table rather than in-memory state, because
 * Vercel serverless functions don't share memory across invocations/regions.
 */

interface RateLimitRule {
  windowMs: number;
  max: number;
}

const RULES: Record<string, RateLimitRule[]> = {
  // Cheap: just stores an image. Loose cap mainly against storage-filling abuse.
  create_reading: [
    { windowMs: 60_000, max: 5 },
    { windowMs: 60 * 60_000, max: 20 },
  ],
  // Expensive: calls the vision model. This is the one that actually burns
  // OpenRouter quota/credits, so it's the tightest limit.
  generate_reading: [
    { windowMs: 60_000, max: 4 },
    { windowMs: 60 * 60_000, max: 15 },
  ],
  // Moderate: one chat turn per question, but a chatty visitor is normal.
  chat_message: [
    { windowMs: 60_000, max: 10 },
    { windowMs: 60 * 60_000, max: 60 },
  ],
};

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function hashClientKey(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT || "palmara-default-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/**
 * Checks (and, if allowed, records) a hit for this client in this bucket.
 * Fails OPEN on infra errors — a rate-limit outage should never be the
 * reason a real user can't use the app.
 */
export async function checkRateLimit(
  bucket: keyof typeof RULES,
  req: Request,
): Promise<RateLimitResult> {
  const rules = RULES[bucket];
  const clientKey = hashClientKey(getClientIp(req));
  const now = Date.now();

  for (const rule of rules) {
    const since = new Date(now - rule.windowMs).toISOString();
    const { count, error } = await supabaseAdmin
      .from("rate_limit_hits")
      .select("id", { count: "exact", head: true })
      .eq("bucket", bucket)
      .eq("client_key", clientKey)
      .gte("created_at", since);

    if (error) {
      console.error(`[rateLimit] check failed for ${bucket}: ${error.message}`);
      return { ok: true };
    }
    if ((count ?? 0) >= rule.max) {
      return { ok: false, retryAfterSeconds: Math.ceil(rule.windowMs / 1000) };
    }
  }

  await supabaseAdmin
    .from("rate_limit_hits")
    .insert({ bucket, client_key: clientKey })
    .then(
      () => {},
      (err) => console.error(`[rateLimit] record failed for ${bucket}:`, err),
    );

  // Opportunistic cleanup so the table doesn't grow forever — no cron needed.
  if (Math.random() < 0.02) {
    const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    supabaseAdmin
      .from("rate_limit_hits")
      .delete()
      .lt("created_at", cutoff)
      .then(
        () => {},
        () => {},
      );
  }

  return { ok: true };
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return {
    body: {
      error:
        "You're moving faster than the reader can keep up. Please wait a moment and try again.",
      kind: "rate_limited" as const,
    },
    init: {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  };
}
