import { NextRequest, NextResponse } from "next/server";
import { getStripe, EBOOK_PRICE_ID } from "@/lib/stripe";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://palmistica.com";

/**
 * Creates a Stripe Checkout Session for the $1 ebook and returns its URL
 * for the client to redirect to. This is the only place a price is ever
 * decided — a real Stripe Price object (STRIPE_EBOOK_PRICE_ID), never an
 * amount supplied by the client. Payment itself happens entirely on
 * Stripe's hosted page; this route never sees card data. See
 * app/api/stripe/webhook/route.ts for how a completed payment actually
 * gets confirmed — never trust this route's own success as proof of that.
 */
export async function POST(req: NextRequest) {
  const limit = await checkRateLimit("ebook_checkout", req);
  if (!limit.ok) {
    const { body: errBody, init } = rateLimitedResponse(limit.retryAfterSeconds);
    return NextResponse.json(errBody, init);
  }

  if (!EBOOK_PRICE_ID || !process.env.STRIPE_SECRET_KEY) {
    console.error("[api/ebook/checkout] Stripe env vars are not fully configured");
    return NextResponse.json(
      { error: "The guide isn't available for purchase just yet. Please check back soon." },
      { status: 503 },
    );
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: EBOOK_PRICE_ID, quantity: 1 }],
      success_url: `${SITE_URL}/ebook/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/ebook`,
    });
    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL");
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[api/ebook/checkout] Stripe error:", err);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 502 },
    );
  }
}
