import { NextResponse } from "next/server";
import { pruneExpiredImages } from "@/lib/readings";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Daily Vercel Cron job (see vercel.json): deletes the stored photo for any
 * reading older than 90 days, clearing image_path but leaving the analysis,
 * Quick Insights, Detailed Reading, and chat history intact.
 *
 * Vercel signs cron-triggered requests with `Authorization: Bearer
 * $CRON_SECRET` when CRON_SECRET is set on the project — set it so this
 * can't be hit by anyone who finds the URL. If it's unset, the route still
 * works (so retention isn't silently broken by a missing env var) but is
 * then only as protected as "the path isn't guessable."
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await pruneExpiredImages();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/prune-images] failed:", err);
    return NextResponse.json({ ok: false, error: "Prune job failed." }, { status: 500 });
  }
}
