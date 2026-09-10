import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Begin a reading" };

export default function ReadPage() {
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-24">
        <div className="mystic-card max-w-md p-10 text-center">
          <p className="eyebrow">Almost</p>
          <h1 className="mt-3 font-serif text-3xl text-cream">The capture flow lands next</h1>
          <p className="mt-4 text-sm leading-relaxed text-cream-muted">
            Camera and upload, client-side preview, and the reading itself are the
            next steps in the build.
          </p>
          <Link href="/" className="btn-ghost mt-8">
            Back to the start
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
