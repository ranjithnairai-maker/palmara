import { NextResponse } from "next/server";
import {
  getReading,
  getMessages,
  getSignedImageUrl,
  isUuid,
} from "@/lib/readings";
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

  const payload: ReadingPayload = { reading, messages, imageUrl };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
