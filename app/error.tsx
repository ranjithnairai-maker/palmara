"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative z-10 flex min-h-[80vh] flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">An unquiet moment</p>
      <h1 className="mt-3 font-serif text-3xl text-cream">
        Something clouded the reading
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-cream-muted">
        A rare hiccup on our side. Try again in a moment.
      </p>
      <div className="mt-8 flex items-center gap-4">
        <button type="button" onClick={reset} className="btn-gold">
          Try again
        </button>
        <Link href="/" className="text-sm text-cream-faint hover:text-gold">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
