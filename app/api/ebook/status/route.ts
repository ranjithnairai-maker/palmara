import { NextRequest, NextResponse } from "next/server";
import { getOrderBySessionId } from "@/lib/ebookOrders";

export const runtime = "nodejs";

/**
 * Polled by the success page. A Checkout Session id is unguessable and
 * carries no purchasing power on its own (see lib/ebookOrders.ts —
 * download_token, not this id, is what actually unlocks a download), so
 * it's safe to look up directly from the URL the browser landed on.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
  }

  const order = await getOrderBySessionId(sessionId);
  if (!order) {
    return NextResponse.json({ paid: false });
  }
  return NextResponse.json({ paid: true, downloadToken: order.download_token });
}
