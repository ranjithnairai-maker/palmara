import { NextResponse } from "next/server";
import { getReading, isUuid } from "@/lib/readings";
import { generateDetailedReading } from "@/lib/generateReading";
import { parseDetailedReading } from "@/lib/parse";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";

// Text-only completion (no image), but still a real model call — give it
// the same generous ceiling as /generate rather than the fast-path's 30s.
export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Generates (or, if already present, just returns) the Detailed Reading
 * for a completed reading. Triggered by the "Reveal Your Full Reading"
 * button. Idempotent — safe to call again once detailed_text exists.
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/readings/[id]/detailed">,
) {
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const reading = await getReading(id);
  if (!reading) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (reading.status !== "complete" || !reading.analysis_json) {
    return NextResponse.json(
      { error: "This reading isn't ready for the full version yet." },
      { status: 409 },
    );
  }

  // Already generated — idempotent no-op, don't spend quota again.
  if (reading.detailed_text) {
    return NextResponse.json({
      id,
      detailedText: reading.detailed_text,
      detailedSections: parseDetailedReading(reading.detailed_text),
    });
  }

  const limit = await checkRateLimit("detailed_reading", req);
  if (!limit.ok) {
    const { body: errBody, init } = rateLimitedResponse(limit.retryAfterSeconds);
    return NextResponse.json(errBody, init);
  }

  const result = await generateDetailedReading(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, kind: result.kind },
      { status: result.kind === "rate_limited" ? 429 : 502 },
    );
  }

  return NextResponse.json({
    id,
    detailedText: result.detailedText,
    detailedSections: parseDetailedReading(result.detailedText),
  });
}
