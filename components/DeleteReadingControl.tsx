"use client";

import { useState, useSyncExternalStore } from "react";

type Props = {
  shareId: string;
  onDeleted: () => void;
};

// No cross-tab/localStorage-change events matter here — the token is only
// ever written once (at creation) and removed by this same component after
// a successful delete, at which point onDeleted() navigates away.
function subscribe() {
  return () => {};
}

function readOwnerToken(shareId: string): string | null {
  try {
    return localStorage.getItem(`palmara_owner_${shareId}`);
  } catch {
    return null;
  }
}

/**
 * Invisible to everyone except the browser that created this reading —
 * ownership is proven by an owner_token stashed in localStorage at
 * creation time, checked here. That check is only a UI convenience; the
 * real enforcement is the server comparing the token on DELETE (see
 * app/api/readings/[id]/route.ts). Anyone else opening this link sees
 * nothing different, not even an empty space where this would be.
 */
export function DeleteReadingControl({ shareId, onDeleted }: Props) {
  // useSyncExternalStore (not useState+useEffect) so the server snapshot is
  // explicitly null — no hydration mismatch — while still reading the real
  // value on the client without a synchronous setState-in-effect.
  const ownerToken = useSyncExternalStore(
    subscribe,
    () => readOwnerToken(shareId),
    () => null,
  );
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ownerToken) return null;

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/readings/${shareId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_token: ownerToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't remove this reading. Please try again.");
        setDeleting(false);
        return;
      }
      try {
        localStorage.removeItem(`palmara_owner_${shareId}`);
      } catch {
        /* not essential */
      }
      onDeleted();
    } catch {
      setError("Network trouble reaching the reader. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-14 border-t border-[rgba(243,238,228,0.08)] pt-6 text-center">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[11px] tracking-wide text-cream-faint underline-offset-4 hover:text-[#e0a0a0] hover:underline"
      >
        Delete this reading
      </button>
      {error && <p className="mt-2 text-xs text-[#f0c9c9]">{error}</p>}

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setConfirming(false)}
        >
          <div
            className="mystic-card w-full max-w-sm p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow">This can&rsquo;t be undone</p>
            <h2 className="mt-3 font-serif text-xl text-cream">
              Remove this reading for good?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-cream-muted">
              The photo, the reading, and every message in the conversation
              will be permanently deleted, along with the share link.
            </p>
            <div className="mt-7 flex flex-col gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn-gold !animate-none disabled:opacity-60"
              >
                {deleting ? "Removing…" : "Yes, delete it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="btn-ghost disabled:opacity-60"
              >
                Keep this reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
