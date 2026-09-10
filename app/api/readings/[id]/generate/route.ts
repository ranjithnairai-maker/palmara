import { NextResponse } from "next/server";
import {
  getReading,
  updateReading,
  loadStoredImageAsDataUrl,
  isUuid,
} from "@/lib/readings";
import { generateAndPersistReading } from "@/lib/generateReading";

// The vision call is the slow part. Platforms that support longer limits
// (e.g. Vercel Pro) can raise this; the model is aborted internally at 55s
// regardless, so a stuck reading always resolves to 'failed' for retry.
export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Runs (or re-runs) the vision model for a reading. Called fire-and-forget
 * by the capture flow right after creation, and by the reading page's retry
 * button. Idempotent: a completed reading is left alone.
 */
export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/readings/[id]/generate">,
) {
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const reading = await getReading(id);
  if (!reading) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (reading.status === "complete") {
    return NextResponse.json({ id, status: "complete" });
  }
  if (!reading.image_path || reading.image_path === "pending") {
    return NextResponse.json(
      { error: "The photo for this reading is missing — start a new one." },
      { status: 409 },
    );
  }

  const dataUrl = await loadStoredImageAsDataUrl(reading.image_path);
  if (!dataUrl) {
    await updateReading(id, { status: "failed" }).catch(() => {});
    return NextResponse.json(
      { error: "Couldn't retrieve the palm photo." },
      { status: 502 },
    );
  }

  await updateReading(id, { status: "processing" });
  const result = await generateAndPersistReading(id, dataUrl);

  if (!result.ok) {
    return NextResponse.json(
      { id, status: "failed", kind: result.kind, error: result.message },
      { status: result.kind === "rate_limited" ? 429 : 502 },
    );
  }
  return NextResponse.json({ id, status: "complete" });
}
