import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { recordPaidOrder } from "@/lib/ebookOrders";

export const runtime = "nodejs";

/**
 * Server-to-server confirmation that an ebook payment actually completed —
 * see CLAUDE.md's "How to actually confirm the Stripe payment" note. The
 * success-page redirect (app/ebook/success/page.tsx) is UX only; THIS
 * route, verified by signature, is the sole source of truth for "did this
 * person actually pay." Never add a path that marks an order paid from
 * anything the browser tells us directly.
 */
export async function POST(req: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    console.error("[api/stripe/webhook] Stripe env vars are not fully configured");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // Signature verification needs the exact raw bytes Stripe signed —
  // req.text() here (not req.json()) is what keeps this untouched by any
  // JSON re-serialization that would break the signature check.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[api/stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    // A completed Checkout session for some payment methods (e.g. certain
    // bank debits) can still be pending rather than actually captured —
    // payment_status is the field that means "money in hand," not the
    // event type alone.
    if (session.payment_status === "paid") {
      try {
        await recordPaidOrder(
          session.id,
          event.id,
          typeof session.customer_details?.email === "string"
            ? session.customer_details.email
            : null,
        );
      } catch (err) {
        console.error("[api/stripe/webhook] failed to record paid order:", err);
        // Non-2xx tells Stripe to retry delivery — recordPaidOrder is
        // idempotent on stripe_session_id, so a retry here is safe.
        return NextResponse.json({ error: "Could not record order." }, { status: 500 });
      }
    }
  } else if (event.type === "checkout.session.async_payment_failed") {
    console.log(`[api/stripe/webhook] async payment failed for session ${
      (event.data.object as Stripe.Checkout.Session).id
    }`);
  }

  return NextResponse.json({ received: true });
}
