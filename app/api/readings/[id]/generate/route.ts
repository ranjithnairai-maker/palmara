import { NextResponse } from "next/server";
import {
  getReading,
  updateReading,
  loadStoredImageAsDataUrl,
  isUuid,
  claimGeneration,
} from "@/lib/readings";
import { generateAndPersistReading } from "@/lib/generateReading";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";

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
  req: Request,
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

  // Gate here, not on the cheap /api/readings POST: this is the call that
  // actually spends OpenRouter quota, so it's the one worth protecting.
  const limit = await checkRateLimit("generate_reading", req);
  if (!limit.ok) {
    const { body: errBody, init } = rateLimitedResponse(limit.retryAfterSeconds);
    return NextResponse.json({ id, status: reading.status, ...errBody }, init);
  }

  // Atomically claims this reading's generation slot — a concurrent
  // duplicate call (the fire-and-forget kickoff racing a retry click, or a
  // retried client request) is turned away here rather than both calling
  // the vision model. Not claiming isn't an error: the client just keeps
  // polling for whichever attempt did win.
  const claimed = await claimGeneration(id);
  if (!claimed) {
    return NextResponse.json({ id, status: "processing" });
  }

  const dataUrl = await loadStoredImageAsDataUrl(reading.image_path);
  if (!dataUrl) {
    await updateReading(id, { status: "failed" }).catch(() => {});
    return NextResponse.json(
      { error: "Couldn't retrieve the palm photo." },
      { status: 502 },
    );
  }

  const result = await generateAndPersistReading(id, dataUrl);

  if (!result.ok) {
    return NextResponse.json(
      { id, status: "failed", kind: result.kind, error: result.message },
      { status: result.kind === "rate_limited" ? 429 : 502 },
    );
  }
  return NextResponse.json({ id, status: "complete" });
}
