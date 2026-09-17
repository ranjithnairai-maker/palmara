const TIERS = [
  { env: process.env.NEXT_PUBLIC_TIP_LINK_1, label: "Leave a spark ✨", amount: "$1" },
  { env: process.env.NEXT_PUBLIC_TIP_LINK_3, label: "Light a candle 🕯️", amount: "$3" },
  { env: process.env.NEXT_PUBLIC_TIP_LINK_5, label: "Send a blessing 🌙", amount: "$5" },
] as const;

const CONFIGURED_TIERS = TIERS.filter(
  (t): t is (typeof TIERS)[number] & { env: string } => Boolean(t.env),
);

// Warn once at module load (not during render, which must stay pure) so a
// missing/misconfigured NEXT_PUBLIC_TIP_LINK_* env var is visible in logs
// rather than silently vanishing the tip section.
if (CONFIGURED_TIERS.length < TIERS.length) {
  const missing = TIERS.filter((t) => !t.env).map((t) => t.amount);
  console.warn(
    `TipJar: missing NEXT_PUBLIC_TIP_LINK env var(s) for ${missing.join(", ")} — omitting ${missing.length === TIERS.length ? "the whole tip section" : "those buttons"}.`,
  );
}

/**
 * Quiet, always-visible support prompt — shown to every viewer (creator and
 * anyone opening a shared link alike), unlike the owner-only delete
 * control. Renders nothing if no tip links are configured, so local/dev
 * environments don't show dead buttons.
 */
export function TipJar() {
  const tiers = CONFIGURED_TIERS;
  if (tiers.length === 0) return null;

  return (
    <div className="mt-12 rounded-2xl border border-[rgba(217,178,94,0.18)] bg-[rgba(23,19,31,0.4)] px-6 py-7 text-center">
      <p className="mx-auto max-w-md text-sm leading-relaxed text-cream-muted">
        Enjoyed your reading? Palmistica is free for everyone, kept alive by
        people who choose to support it. If this moment meant something to
        you, a small tip helps keep the magic going for the next person too.
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {tiers.map((t) => (
          <a
            key={t.amount}
            href={t.env}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(217,178,94,0.4)] bg-transparent px-5 py-2 text-xs font-medium tracking-wide text-gold transition-all hover:bg-[rgba(217,178,94,0.1)] hover:shadow-[0_0_18px_-4px_rgba(217,178,94,0.55)]"
          >
            {t.label}
          </a>
        ))}
      </div>
    </div>
  );
}
