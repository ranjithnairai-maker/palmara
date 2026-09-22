"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const CHAPTERS = [
  "Reading a palm: the shape, the mounts, the four lines",
  "The Life Line — vitality, change, and the myth that won't quit",
  "The Heart Line — how you love, curved or straight",
  "The Head Line — how you think, and the writer's fork",
  "The Fate Line — direction, and what it means to not have one",
  "The seven mounts, one by one",
  "Earth, Water, Air, Fire — finding your hand's element",
];

export default function EbookPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ebook/checkout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error ?? "Couldn't start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network trouble reaching checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <div className="text-center">
          <p className="eyebrow">The full guide</p>
          <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
            Learn Palmistry Basics
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-cream-muted">
            Everything the free reading only has room to touch on: every
            line, every mount, every hand shape, in one illustrated guide
            you keep for good.
          </p>
        </div>

        <div className="mystic-card mt-10 p-8">
          <p className="eyebrow">What&rsquo;s inside</p>
          <ul className="mt-4 space-y-2.5">
            {CHAPTERS.map((c) => (
              <li key={c} className="flex gap-2.5 text-sm leading-relaxed text-cream-muted">
                <span className="mt-0.5 shrink-0 text-gold">✦</span>
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 text-center">
          <p className="font-serif text-2xl text-gold-bright">$1</p>
          <p className="mt-1 text-xs tracking-wide text-cream-faint">
            One-time. Yours to keep. No account needed.
          </p>
          <button
            type="button"
            onClick={startCheckout}
            disabled={loading}
            className="btn-gold mt-6 disabled:opacity-60"
          >
            {loading ? "Starting checkout…" : "Get the Ebook"}
          </button>
          {error && <p className="mt-4 text-sm text-[#f0c9c9]">{error}</p>}
          <p className="mt-4 text-[11px] text-cream-faint">
            Checkout is handled securely by Stripe. Palmistica never sees
            your card details.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="text-xs tracking-wide text-cream-faint underline-offset-4 hover:text-gold"
          >
            ← Back to the start
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
