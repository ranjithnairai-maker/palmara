import { NextRequest, NextResponse } from "next/server";
import {
  createReading,
  decodeDataUrl,
  updateReading,
  uploadPalmImage,
} from "@/lib/readings";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";

export const maxDuration = 30;
export const runtime = "nodejs";

// Base64 adds ~1/3 overhead, and this arrives as a JSON body — Vercel
// Functions cap request bodies at 4.5MB regardless of what this route
// configures, so a decoded-image cap has to leave room for that expansion
// or large-but-under-this-limit uploads would 413 at the platform edge
// before ever reaching this handler. 3MB decoded ≈ 4MB encoded, safely
// under that ceiling. Normal uploads are far smaller anyway — the client
// (lib/compressImage.ts) resizes to 1200px before this route ever sees it.
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Creates a reading: validates + stores the palm image, inserts a row in
 * 'processing' state, and returns its id immediately. The actual vision
 * model call happens in POST /api/readings/[id]/generate so this request
 * stays well under the serverless timeout.
 */
export async function POST(req: NextRequest) {
  const limit = await checkRateLimit("create_reading", req);
  if (!limit.ok) {
    const { body: errBody, init } = rateLimitedResponse(limit.retryAfterSeconds);
    return NextResponse.json(errBody, init);
  }

  let body: { image?: unknown };
  try {
    const parsed: unknown = await req.json();
    // req.json() can resolve to any valid JSON value (null, an array, a
    // string...), not just an object — the previous unconditional
    // `body.image` access below would throw on a literal `null` body,
    // surfacing as an unhandled 500 instead of the 400 this deserves.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    body = parsed as { image?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.image !== "string" || !body.image.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Send the palm photo as a base64 image data URL." },
      { status: 400 },
    );
  }

  let decoded;
  try {
    decoded = decodeDataUrl(body.image);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unreadable image." },
      { status: 400 },
    );
  }

  if (decoded.buffer.byteLength < 1024) {
    return NextResponse.json(
      { error: "That image looks empty. Try another photo." },
      { status: 400 },
    );
  }
  if (decoded.buffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: "That image is too large. Please use a smaller photo." },
      { status: 413 },
    );
  }

  const reading = await createReading("pending");
  try {
    const imagePath = await uploadPalmImage(reading.id, decoded);
    await updateReading(reading.id, { image_path: imagePath });
  } catch (err) {
    console.error("[api/readings] storage failure:", err);
    await supabaseAdmin.from("readings").delete().eq("id", reading.id);
    return NextResponse.json(
      { error: "Could not store the image. Please try again." },
      { status: 502 },
    );
  }

  // owner_token is returned exactly once, here, and never again — the
  // client is responsible for stashing it (localStorage) if it wants to be
  // able to delete this reading later. It is never included in any GET
  // response or page payload (see toPublicReading()).
  return NextResponse.json({
    id: reading.id,
    status: "processing",
    ownerToken: reading.owner_token,
  });
}
