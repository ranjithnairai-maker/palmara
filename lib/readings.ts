import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin, PALM_BUCKET } from "./supabase";
import type { AnalysisJson, PublicReading, Reading, ReadingMessage } from "./types";

const SIGNED_URL_TTL = 60 * 60; // 1 hour
const RETENTION_DAYS = 90;

export interface DecodedImage {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Parses a `data:<mime>;base64,<data>` URL into a buffer. */
export function decodeDataUrl(dataUrl: string): DecodedImage {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
    dataUrl.trim(),
  );
  if (!match) {
    throw new Error("Expected a base64 JPEG, PNG, or WebP data URL.");
  }
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, contentType, ext: MIME_EXT[contentType] ?? "jpg" };
}

export async function uploadPalmImage(
  readingId: string,
  img: DecodedImage,
): Promise<string> {
  const path = `${readingId}/palm.${img.ext}`;
  const { error } = await supabaseAdmin.storage
    .from(PALM_BUCKET)
    .upload(path, img.buffer, {
      contentType: img.contentType,
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function createReading(imagePath: string): Promise<Reading> {
  const { data, error } = await supabaseAdmin
    .from("readings")
    .insert({ image_path: imagePath, status: "processing", reading_text: "" })
    .select()
    .single();
  if (error) throw new Error(`Insert reading failed: ${error.message}`);
  return data as Reading;
}

export async function updateReading(
  id: string,
  patch: Partial<
    Pick<
      Reading,
      | "hand_element"
      | "reading_text"
      | "status"
      | "image_path"
      | "analysis_json"
      | "detailed_text"
      | "detailed_status"
      | "image_deleted_at"
      | "generation_claimed_at"
    >
  >,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("readings")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(`Update reading failed: ${error.message}`);
}

// How long a claimed-but-not-yet-resolved generation attempt is trusted to
// still be running before a later request is allowed to recover it. Well
// above FUNCTION_TIME_BUDGET_MS / DETAILED_BACKGROUND_TIMEOUT_MS in
// lib/generateReading.ts so a healthy in-flight attempt is never
// second-guessed, but short enough that a crashed/killed invocation doesn't
// strand a reading forever.
const GENERATION_LEASE_MS = 90_000;

/**
 * Atomically claims the main reading-generation slot for `id`, so two
 * concurrent /generate calls (a double-click, a retry racing the original
 * fire-and-forget kickoff) can't both call the vision model. Returns true
 * only for the single caller allowed to proceed. Safe to call on a fresh
 * reading (status defaults to 'processing' with no lease yet — that first
 * call claims it), a 'failed' one (always reclaimable — the previous
 * attempt already finished), or a 'processing' one whose lease has expired
 * (recovers an abandoned attempt). Never claims a 'complete' reading.
 */
export async function claimGeneration(id: string): Promise<boolean> {
  const now = new Date();
  const leaseExpiry = new Date(now.getTime() - GENERATION_LEASE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("readings")
    .update({ status: "processing", generation_claimed_at: now.toISOString() })
    .eq("id", id)
    .neq("status", "complete")
    .or(`status.neq.processing,generation_claimed_at.is.null,generation_claimed_at.lt.${leaseExpiry}`)
    .select("id");
  if (error) throw new Error(`Claim generation failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Same idea as claimGeneration() but for the on-demand Detailed Reading
 * step, keyed off detailed_status/detailed_text instead — that pair
 * already distinguishes "not started" (null) from "in flight"
 * ('processing') from "done" (detailed_text set), so this needs no lease:
 * a stuck 'processing' status still blocks a second claim (background
 * generation for this tier is short enough — see
 * DETAILED_BACKGROUND_TIMEOUT_MS — that a lease isn't worth the added
 * complexity here), but any failure message in detailed_status is always
 * reclaimable immediately, same as claimGeneration()'s 'failed' handling.
 */
export async function claimDetailedGeneration(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("readings")
    .update({ detailed_status: "processing" })
    .eq("id", id)
    .is("detailed_text", null)
    // Plain .neq() would silently exclude NULL rows too (`NULL <> 'processing'`
    // is NULL/falsy in Postgres, not true) — the never-started case is the
    // common one, so it has to be spelled out explicitly here.
    .or("detailed_status.is.null,detailed_status.neq.processing")
    .select("id");
  if (error) throw new Error(`Claim detailed generation failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function addMessage(
  readingId: string,
  role: "user" | "assistant",
  content: string,
): Promise<ReadingMessage> {
  const { data, error } = await supabaseAdmin
    .from("reading_messages")
    .insert({ reading_id: readingId, role, content })
    .select()
    .single();
  if (error) throw new Error(`Insert message failed: ${error.message}`);
  return data as ReadingMessage;
}

export interface OgReadingData {
  headline: string | null;
  handElement: string | null;
}

/** Narrow query for share-image rendering (opengraph-image.tsx /
 * twitter-image.tsx) — only the two fields the image needs, never the full
 * reading or the photo. Keeps image generation fast and independent of the
 * 90-day photo-retention prune. Returns null for anything not a complete,
 * viewable reading (missing, still processing, or deleted). */
export async function getReadingOgData(id: string): Promise<OgReadingData | null> {
  const { data, error } = await supabaseAdmin
    .from("readings")
    .select("analysis_json, hand_element, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || data.status !== "complete") return null;
  const analysis = data.analysis_json as AnalysisJson | null;
  return {
    headline: analysis?.headline?.trim() || null,
    handElement: (data.hand_element as string | null) ?? null,
  };
}

export async function getReading(id: string): Promise<Reading | null> {
  const { data, error } = await supabaseAdmin
    .from("readings")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Fetch reading failed: ${error.message}`);
  return (data as Reading) ?? null;
}

/** Strips owner_token before a reading is sent to any client — every route
 * that builds a ReadingPayload must go through this, never send the raw row. */
export function toPublicReading(reading: Reading): PublicReading {
  const { owner_token: _owner_token, ...rest } = reading;
  void _owner_token;
  return rest;
}

/** Constant-time-ish ownership check: compares SHA-256 digests (fixed
 * length) rather than the raw tokens, so response timing can't be used to
 * narrow down a guess. This is the one real authorization boundary in an
 * app with no accounts, so it's worth the few extra lines. */
export function ownerTokenMatches(stored: string, supplied: unknown): boolean {
  if (typeof supplied !== "string" || !supplied) return false;
  const a = createHash("sha256").update(stored).digest();
  const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a, b);
}

export async function getMessages(readingId: string): Promise<ReadingMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("reading_messages")
    .select()
    .eq("reading_id", readingId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Fetch messages failed: ${error.message}`);
  return (data as ReadingMessage[]) ?? [];
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Downloads a stored palm image and returns it as a base64 data URL. */
export async function loadStoredImageAsDataUrl(
  imagePath: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(PALM_BUCKET)
    .download(imagePath);
  if (error || !data) return null;
  const ext = imagePath.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = MIME_BY_EXT[ext] ?? "image/jpeg";
  const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  return `data:${mime};base64,${base64}`;
}

export async function getSignedImageUrl(
  imagePath: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(PALM_BUCKET)
    .createSignedUrl(imagePath, SIGNED_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}

/** UUID v4 shape check for route params. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Owner-initiated delete: removes the stored image (if any), records a
 * tombstone so the id's URL can show a friendly "removed" message instead
 * of an indistinguishable 404, then deletes the readings row — cascading
 * to reading_messages via the existing `on delete cascade`.
 */
export async function deleteReadingCompletely(reading: Reading): Promise<void> {
  if (reading.image_path && reading.image_path !== "pending") {
    // Supabase Storage resolves with { error } on failure rather than
    // rejecting, so a bare .catch() here previously never saw it — the row
    // would still get deleted below and report success while the photo
    // silently stayed in the bucket forever. One retry (storage failures
    // here are usually transient), then proceed with the deletion either
    // way — the owner explicitly asked for this and the row/tombstone are
    // the part of the promise we can guarantee; log loudly so an orphaned
    // object is at least visible for manual/cron cleanup instead of lost.
    let { error: storageError } = await supabaseAdmin.storage
      .from(PALM_BUCKET)
      .remove([reading.image_path]);
    if (storageError) {
      ({ error: storageError } = await supabaseAdmin.storage
        .from(PALM_BUCKET)
        .remove([reading.image_path]));
    }
    if (storageError) {
      console.error(
        `[readings] failed to delete storage object ${reading.image_path} for reading ${reading.id}: ${storageError.message}`,
      );
    }
  }
  const { error: tombstoneError } = await supabaseAdmin
    .from("deleted_readings")
    .insert({ id: reading.id });
  if (tombstoneError) {
    throw new Error(`Tombstone insert failed: ${tombstoneError.message}`);
  }
  const { error } = await supabaseAdmin
    .from("readings")
    .delete()
    .eq("id", reading.id);
  if (error) throw new Error(`Delete reading failed: ${error.message}`);
}

/** True if this id belonged to a reading its owner deleted. */
export async function isDeletedReading(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("deleted_readings")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

/**
 * Retention job: for readings older than 90 days with a still-present
 * image, deletes the Storage object and clears image_path — everything
 * else (analysis, Quick Insights, Detailed Reading, chat history) is left
 * untouched. Called from the daily Vercel Cron route.
 */
export async function pruneExpiredImages(): Promise<{ pruned: number; checked: number }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("readings")
    .select("id, image_path")
    .lt("created_at", cutoff)
    .is("image_deleted_at", null)
    .not("image_path", "is", null);
  if (error) throw new Error(`Prune query failed: ${error.message}`);

  const rows = (data as Pick<Reading, "id" | "image_path">[]) ?? [];
  let pruned = 0;
  for (const row of rows) {
    if (!row.image_path || row.image_path === "pending") continue;
    // Only clear image_path once the object is actually confirmed gone —
    // Storage resolves with { error } rather than rejecting on failure, so
    // the previous unconditional .catch(() => {}) here masked that and the
    // row got marked pruned regardless, permanently losing track of an
    // orphaned object (it drops out of tomorrow's query too, since that
    // filters on image_path). Leaving image_path intact on failure lets the
    // next daily run retry it instead.
    const { error: storageError } = await supabaseAdmin.storage
      .from(PALM_BUCKET)
      .remove([row.image_path]);
    if (storageError) {
      console.error(
        `[readings] prune: failed to delete storage object ${row.image_path} for reading ${row.id}: ${storageError.message}`,
      );
      continue;
    }
    const { error: updateError } = await supabaseAdmin
      .from("readings")
      .update({ image_path: null, image_deleted_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) {
      console.error(
        `[readings] prune: storage object ${row.image_path} deleted but DB update failed for reading ${row.id}: ${updateError.message}`,
      );
      continue;
    }
    pruned++;
  }
  return { pruned, checked: rows.length };
}

export type { AnalysisJson };
