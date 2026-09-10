/**
 * Slow-drifting star layers. Pure CSS motion — no client JS.
 * Two parallax layers of pin-prick stars plus a few brighter "wish" stars.
 */
export function Starfield({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="absolute -inset-[40%] opacity-[0.55] [animation:var(--animate-star-drift)]"
        style={{
          backgroundImage:
            "radial-gradient(1.5px 1.5px at 20% 30%, rgba(243,238,228,0.9), transparent), radial-gradient(1px 1px at 60% 70%, rgba(243,238,228,0.7), transparent), radial-gradient(1.5px 1.5px at 80% 20%, rgba(217,178,94,0.8), transparent), radial-gradient(1px 1px at 40% 80%, rgba(243,238,228,0.6), transparent), radial-gradient(1px 1px at 75% 55%, rgba(243,238,228,0.5), transparent), radial-gradient(1.5px 1.5px at 10% 60%, rgba(243,238,228,0.7), transparent)",
          backgroundSize: "620px 620px",
        }}
      />
      <div
        className="absolute -inset-[40%] opacity-40 [animation:var(--animate-star-drift-slow)]"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 15% 15%, rgba(243,238,228,0.7), transparent), radial-gradient(1px 1px at 50% 45%, rgba(243,238,228,0.5), transparent), radial-gradient(1.5px 1.5px at 85% 75%, rgba(217,178,94,0.6), transparent), radial-gradient(1px 1px at 30% 90%, rgba(243,238,228,0.6), transparent)",
          backgroundSize: "420px 420px",
        }}
      />
    </div>
  );
}
