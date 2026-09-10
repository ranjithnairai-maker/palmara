import { NextRequest, NextResponse } from "next/server";
import {
  createReading,
  decodeDataUrl,
  updateReading,
  uploadPalmImage,
} from "@/lib/readings";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB hard cap server-side

/**
 * Creates a reading: validates + stores the palm image, inserts a row in
 * 'processing' state, and returns its id immediately. The actual vision
 * model call happens in POST /api/readings/[id]/generate so this request
 * stays well under the serverless timeout.
 */
export async function POST(req: NextRequest) {
  let body: { image?: unknown };
  try {
    body = await req.json();
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
    await supabaseAdmin.from("readings").delete().eq("id", reading.id);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not store the image.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ id: reading.id, status: "processing" });
}
