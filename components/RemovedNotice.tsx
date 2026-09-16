import Link from "next/link";
import { PalmGlyph } from "./PalmGlyph";

export function RemovedNotice() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <PalmGlyph className="w-24 opacity-35" />
      <p className="eyebrow mt-7">Gone quietly</p>
      <h1 className="mt-3 font-serif text-2xl text-cream">
        This reading has been removed by its owner
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-cream-muted">
        Whoever created it chose to take it down. If that was you and you
        meant to keep it, there&rsquo;s no way to bring it back — but a new
        reading only takes a minute.
      </p>
      <Link href="/read" className="btn-gold mt-8">
        Get a new reading
      </Link>
    </div>
  );
}
