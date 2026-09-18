import Link from "next/link";

type Props = {
  /** "Begin" reads oddly once someone already has a reading open — pages
   * that render an existing reading (e.g. /reading/[id]) should pass
   * something like "Redo Palm Reading" instead. Always still links to
   * /read either way. */
  ctaLabel?: string;
};

export function SiteHeader({ ctaLabel = "Begin" }: Props) {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link href="/" className="group flex items-center gap-2.5">
        <span className="relative grid h-9 w-9 place-items-center rounded-full border border-[rgba(217,178,94,0.4)] bg-[rgba(61,31,79,0.35)]">
          <span className="text-lg leading-none text-gold">✦</span>
          <span className="absolute inset-0 rounded-full [animation:var(--animate-glow-pulse)] opacity-40 transition-opacity group-hover:opacity-70" />
        </span>
        <span className="font-serif text-xl tracking-wide text-cream">Palmistica</span>
      </Link>
      <Link
        href="/read"
        className="btn-ghost !px-5 !py-2 text-xs uppercase tracking-[0.14em]"
      >
        {ctaLabel}
      </Link>
    </header>
  );
}
