import Stripe from "stripe";

/**
 * Server-only Stripe client for the ebook checkout flow. Distinct from the
 * tip jar (components/TipJar.tsx), which uses plain Stripe Payment Links —
 * no server-side Stripe integration at all — because tips are variable,
 * client-editable-at-the-Stripe-page amounts with no digital good to
 * deliver. The ebook is a fixed $1 Price tied to a real deliverable, so it
 * needs a server-created Checkout Session and a verified webhook before
 * anything is handed over. See lib/ebookOrders.ts and CLAUDE.md.
 *
 * getStripe() constructs lazily, at request time, rather than at module
 * load — unlike lib/supabase.ts's eager throw-if-unset, this subsystem is
 * genuinely optional until STRIPE_SECRET_KEY is configured (e.g. before
 * the Stripe dashboard setup in CLAUDE.md is done), and Next's build
 * process imports every route module to collect its config. An eager
 * throw here would fail `npm run build` for the whole app the moment this
 * one env var is unset, not just make the ebook routes unavailable.
 */
let cachedClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!cachedClient) {
    cachedClient = new Stripe(secretKey);
  }
  return cachedClient;
}

export const EBOOK_PRICE_ID = process.env.STRIPE_EBOOK_PRICE_ID;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
