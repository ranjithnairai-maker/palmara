import { EBOOK_BUCKET, EBOOK_FILE_PATH, supabaseAdmin } from "./supabase";

// Short-lived on purpose — this URL is only ever handed straight to a
// browser redirect immediately after a download_token check passes, never
// stored or emailed. The download_token (48h, capped-use) is the real
// access control; this is just the transport underneath it.
const DOWNLOAD_SIGNED_URL_TTL = 5 * 60;

export interface EbookOrder {
  id: string;
  stripe_session_id: string;
  email: string | null;
  paid_at: string;
  download_token: string;
  download_count: number;
  max_downloads: number;
  expires_at: string;
}

/**
 * Records a paid order. Called only from the verified Stripe webhook
 * handler (app/api/stripe/webhook/route.ts), never from client-reachable
 * code — see CLAUDE.md / SECURITY.md on why the success-page redirect is
 * never itself the trigger for this. Idempotent on stripe_session_id: a
 * retried webhook delivery for the same session just no-ops rather than
 * creating a second order or erroring.
 */
export async function recordPaidOrder(
  sessionId: string,
  eventId: string,
  email: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ebook_orders")
    .insert({ stripe_session_id: sessionId, stripe_event_id: eventId, email })
    .select("id")
    .single();
  if (error) {
    // Unique violation on stripe_session_id means this event was already
    // processed by an earlier delivery attempt — exactly the idempotency
    // Stripe's retry behavior requires, not a real failure.
    if (error.code === "23505") return;
    throw new Error(`Insert ebook order failed: ${error.message}`);
  }
}

/** Looked up by the success page's polling — existence of a row means paid. */
export async function getOrderBySessionId(
  sessionId: string,
): Promise<EbookOrder | null> {
  const { data, error } = await supabaseAdmin
    .from("ebook_orders")
    .select()
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`Fetch ebook order failed: ${error.message}`);
  return (data as EbookOrder) ?? null;
}

export type ClaimDownloadResult =
  | { ok: true; signedUrl: string }
  | { ok: false; reason: "not_found" | "expired" | "exhausted" };

/**
 * Atomically claims one download against a token's cap, then mints a
 * fresh short-lived signed URL for the shared PDF object. The `.lt()` on
 * download_count in the update's WHERE clause (not just checked
 * beforehand) is what makes the increment race-safe — two simultaneous
 * requests against the last remaining download can't both succeed.
 */
export async function claimDownload(token: string): Promise<ClaimDownloadResult> {
  const { data: order, error: fetchError } = await supabaseAdmin
    .from("ebook_orders")
    .select("id, download_count, max_downloads, expires_at")
    .eq("download_token", token)
    .maybeSingle();
  if (fetchError) throw new Error(`Fetch download token failed: ${fetchError.message}`);
  if (!order) return { ok: false, reason: "not_found" };
  if (new Date(order.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("ebook_orders")
    .update({ download_count: order.download_count + 1 })
    .eq("id", order.id)
    .lt("download_count", order.max_downloads)
    .select("id");
  if (claimError) throw new Error(`Claim download failed: ${claimError.message}`);
  if (!claimed || claimed.length === 0) return { ok: false, reason: "exhausted" };

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(EBOOK_BUCKET)
    .createSignedUrl(EBOOK_FILE_PATH, DOWNLOAD_SIGNED_URL_TTL);
  if (signError || !signed) {
    throw new Error(`Sign ebook download URL failed: ${signError?.message}`);
  }
  return { ok: true, signedUrl: signed.signedUrl };
}
