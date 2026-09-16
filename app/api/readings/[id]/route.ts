import { NextResponse } from "next/server";
import {
  getReading,
  getMessages,
  getSignedImageUrl,
  isUuid,
  toPublicReading,
  ownerTokenMatches,
  deleteReadingCompletely,
} from "@/lib/readings";
import { parseDetailedReading } from "@/lib/parse";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";
import type { ReadingPayload } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/readings/[id]">,
) {
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const reading = await getReading(id);
  if (!reading) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [messages, imageUrl] = await Promise.all([
    getMessages(id),
    reading.image_path && reading.image_path !== "pending"
      ? getSignedImageUrl(reading.image_path)
      : Promise.resolve(null),
  ]);

  const payload: ReadingPayload = {
    reading: toPublicReading(reading),
    messages,
    imageUrl,
    detailedSections: reading.detailed_text
      ? parseDetailedReading(reading.detailed_text)
      : null,
  };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Owner-only delete. There are no accounts, so ownership is proven by the
 * owner_token the client stashed at creation time — the hidden delete
 * button in the UI is not the security boundary, this check is (see
 * SECURITY.md and ownerTokenMatches()).
 */
export async function DELETE(
  req: Request,
  ctx: RouteContext<"/api/readings/[id]">,
) {
  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const limit = await checkRateLimit("delete_reading", req);
  if (!limit.ok) {
    const { body: errBody, init } = rateLimitedResponse(limit.retryAfterSeconds);
    return NextResponse.json(errBody, init);
  }

  let body: { owner_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const reading = await getReading(id);
  if (!reading) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!ownerTokenMatches(reading.owner_token, body.owner_token)) {
    return NextResponse.json(
      { error: "This reading can only be removed from the browser that created it." },
      { status: 403 },
    );
  }

  try {
    await deleteReadingCompletely(reading);
  } catch (err) {
    console.error("[api/readings DELETE] failed:", err);
    return NextResponse.json(
      { error: "Couldn't remove this reading. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ deleted: true });
}
