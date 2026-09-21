"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MysticLoader } from "@/components/MysticLoader";

type PollState = "waiting" | "ready" | "timed_out" | "missing_session";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 16; // ~40s — Stripe webhooks typically land within a few seconds

export function EbookSuccessClient() {
  const sessionId = useSearchParams().get("session_id");
  const [state, setState] = useState<PollState>(sessionId ? "waiting" : "missing_session");
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const pollsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/ebook/status?session_id=${encodeURIComponent(sessionId!)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.paid && data.downloadToken) {
          setDownloadToken(data.downloadToken);
          setState("ready");
          return;
        }
      } catch {
        // transient — keep polling until MAX_POLLS
      }
      pollsRef.current += 1;
      if (pollsRef.current >= MAX_POLLS) {
        if (!cancelled) setState("timed_out");
        return;
      }
      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state === "missing_session") {
    return (
      <p className="mx-auto mt-6 max-w-sm text-center text-sm leading-relaxed text-cream-muted">
        That link is missing its checkout reference. If you just paid, check
        your email from Stripe for a receipt, or{" "}
        <Link href="/ebook" className="underline decoration-[rgba(217,178,94,0.4)] hover:text-gold">
          try again
        </Link>
        .
      </p>
    );
  }

  if (state === "ready" && downloadToken) {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm leading-relaxed text-cream-muted">
          Payment received. Your guide is ready.
        </p>
        <a href={`/api/ebook/download?token=${downloadToken}`} className="btn-gold mt-6 inline-block">
          Download the guide
        </a>
        <p className="mt-4 text-[11px] text-cream-faint">
          This link stays valid for 48 hours. You can come back to this page
          to use it again if you need to.
        </p>
      </div>
    );
  }

  if (state === "timed_out") {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm leading-relaxed text-cream-muted">
          Payment is taking a little longer to confirm than usual. This page
          will keep working once it lands — try reloading it in a minute.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-center">
      <MysticLoader label="Payment received, preparing your download…" />
    </div>
  );
}
