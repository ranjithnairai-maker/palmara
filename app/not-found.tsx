import Link from "next/link";
import { PalmGlyph } from "@/components/PalmGlyph";

export default function NotFound() {
  return (
    <main className="relative z-10 flex min-h-[80vh] flex-1 flex-col items-center justify-center px-6 text-center">
      <PalmGlyph className="w-28 opacity-40" />
      <p className="eyebrow mt-8">Lost the thread</p>
      <h1 className="mt-3 font-serif text-3xl text-cream">
        There&rsquo;s no reading here
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-cream-muted">
        This link may be mistyped, or the reading has since been cleared away.
      </p>
      <Link href="/" className="btn-gold mt-8">
        Back to Palmistica
      </Link>
    </main>
  );
}
