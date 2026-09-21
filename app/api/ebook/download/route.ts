import { NextRequest, NextResponse } from "next/server";
import { claimDownload } from "@/lib/ebookOrders";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";

const FAILURE_MESSAGE: Record<"not_found" | "expired" | "exhausted", string> = {
  not_found: "That download link isn't valid.",
  expired: "That download link has expired. It's good for 48 hours after purchase.",
  exhausted: "That link has already been used to download the guide.",
};

/**
 * Claims one download against the token's cap (see lib/ebookOrders.ts
 * claimDownload) and redirects to a freshly minted, short-lived signed
 * URL for the actual PDF bytes. The token, not this signed URL, is the
 * real access control — the signed URL is just transport underneath it.
 */
export async function GET(req: NextRequest) {
  const limit = await checkRateLimit("ebook_download", req);
  if (!limit.ok) {
    const { body: errBody, init } = rateLimitedResponse(limit.retryAfterSeconds);
    return NextResponse.json(errBody, init);
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const result = await claimDownload(token);
  if (!result.ok) {
    return NextResponse.json({ error: FAILURE_MESSAGE[result.reason] }, { status: 410 });
  }
  return NextResponse.redirect(result.signedUrl);
}
