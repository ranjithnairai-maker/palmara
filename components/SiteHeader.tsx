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
    <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
      <Link href="/" className="group flex min-w-0 items-center gap-2 sm:gap-2.5">
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[rgba(217,178,94,0.4)] bg-[rgba(61,31,79,0.35)] sm:h-9 sm:w-9">
          <span className="text-base leading-none text-gold sm:text-lg">✦</span>
          <span className="absolute inset-0 rounded-full [animation:var(--animate-glow-pulse)] opacity-40 transition-opacity group-hover:opacity-70" />
        </span>
        <span className="truncate font-serif text-lg tracking-wide text-cream sm:text-xl">
          Palmistica
        </span>
      </Link>
      <Link
        href="/read"
        // whitespace-nowrap matters here: .btn-ghost is inline-flex, which
        // doesn't stop its text node from wrapping — a longer ctaLabel
        // ("Redo Palm Reading") wrapped onto two lines and collided with
        // the logo on narrow screens without it. Sizes step down at `sm`
        // so the longer label still fits on one line on a phone.
        className="btn-ghost shrink-0 whitespace-nowrap !px-3 !py-1.5 text-[10px] uppercase tracking-[0.08em] sm:!px-5 sm:!py-2 sm:text-xs sm:tracking-[0.14em]"
      >
        {ctaLabel}
      </Link>
    </header>
  );
}
