import { NextResponse, after } from "next/server";
import { getReading, isUuid, claimDetailedGeneration } from "@/lib/readings";
import { runDetailedReadingGeneration } from "@/lib/generateReading";
import { parseDetailedReading } from "@/lib/parse";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";

// Generation itself runs in the background via after() rather than being
// awaited here — see lib/generateReading.ts. maxDuration still bounds that
// background work (the invocation isn't considered finished until it
// completes or this ceiling hits), but no client is left holding an open
// HTTP request for the whole time either way.
export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Kicks off (or, if already generated, just returns) the Detailed Reading
 * for a completed reading. Triggered by the "Reveal Your Full Reading"
 * button. Returns fast either way — the client polls GET
 * /api/readings/[id] to see the result land once generation finishes.
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
      status: "complete",
      detailedText: reading.detailed_text,
      detailedSections: parseDetailedReading(reading.detailed_text),
    });
  }

  // Already in flight (a double-click, or the client re-polling after a
  // page reload mid-generation) — don't start a second one, just tell the
  // client to keep polling.
  if (reading.detailed_status === "processing") {
    return NextResponse.json({ id, status: "processing" });
  }

  const limit = await checkRateLimit("detailed_reading", req);
  if (!limit.ok) {
    const { body: errBody, init } = rateLimitedResponse(limit.retryAfterSeconds);
    return NextResponse.json(errBody, init);
  }

  // Atomically claims the detailed-generation slot — closes the gap
  // between the reading-fetch checks above and this write, where a second
  // concurrent request could otherwise also pass them and trigger a second
  // model call. Losing the race isn't an error: another request already
  // has it in flight, so the client just keeps polling.
  const claimed = await claimDetailedGeneration(id);
  if (!claimed) {
    return NextResponse.json({ id, status: "processing" });
  }

  // Fire-and-forget: this can legitimately take 20-50+ seconds on the free
  // model — far too long to hold a single request/response open for
  // reliably. after() keeps it running past this handler's return without
  // blocking the response, same reasoning as the main reading's /generate
  // two-phase flow.
  after(() => runDetailedReadingGeneration(id));

  return NextResponse.json({ id, status: "processing" });
}
