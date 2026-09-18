import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { ReadingView } from "@/components/ReadingView";
import { RemovedNotice } from "@/components/RemovedNotice";
import {
  getReading,
  getReadingOgData,
  getMessages,
  getSignedImageUrl,
  isUuid,
  isDeletedReading,
  toPublicReading,
} from "@/lib/readings";
import { parseDetailedReading } from "@/lib/parse";
import type { ReadingPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

// noindex is deliberate and independent of the rich sharing metadata below:
// a reading is a public, unguessable-URL resource (like a shared-link doc,
// see SECURITY.md), not something meant to turn up in search results —
// noindex only affects search engines, never social share previews.
const NO_INDEX: Pick<Metadata, "robots"> = { robots: { index: false, follow: false } };

export async function generateMetadata(props: PageProps<"/r/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!isUuid(id)) return { title: "Reading not found", ...NO_INDEX };

  const og = await getReadingOgData(id).catch(() => null);
  if (!og) return { title: "A palm reading", ...NO_INDEX };

  const headline = og.headline || "A reading, written for one hand only.";
  // Deliberately distinct from the headline above — some platforms show
  // the OG title and description side by side, and duplicating the same
  // line there reads as lazy/templated.
  const article = og.handElement && /^[aeiou]/i.test(og.handElement) ? "an" : "a";
  const description = og.handElement
    ? `Read as ${article} ${og.handElement} hand, the four major lines, and one warm reflection — free at Palmistica.`
    : "The four major lines, the hand's element, and one warm reflection — read free at Palmistica.";

  return {
    // Root layout's title template ("%s · Palmistica") already appends the
    // brand name — don't add it again here.
    title: headline,
    description,
    ...NO_INDEX,
    openGraph: {
      url: `/r/${id}`,
      type: "website",
      // opengraph-image.tsx in this same route segment is picked up
      // automatically — don't also list `images` here, or it duplicates.
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function SharePage(props: PageProps<"/r/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();

  const reading = await getReading(id);
  if (!reading) {
    if (await isDeletedReading(id)) {
      return (
        <>
          <ShareHeader />
          <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-6 py-10">
            <RemovedNotice />
          </main>
          <SiteFooter />
        </>
      );
    }
    notFound();
  }

  // A share link should only ever show a finished reading.
  if (reading.status !== "complete") {
    return (
      <>
        <ShareHeader />
        <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-6 py-24">
          <div className="mystic-card p-10 text-center">
            <p className="eyebrow">Not ready</p>
            <h1 className="mt-3 font-serif text-2xl text-cream">
              This reading isn&rsquo;t finished
            </h1>
            <p className="mt-3 text-sm text-cream-muted">
              The link will come to life once the reading completes.
            </p>
            <Link href="/read" className="btn-gold mt-7 inline-flex">
              Get your own reading
            </Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const [messages, imageUrl] = await Promise.all([
    getMessages(id),
    reading.image_path && reading.image_path !== "pending"
      ? getSignedImageUrl(reading.image_path)
      : Promise.resolve(null),
  ]);

  const payload: ReadingPayload = {
    reading: toPublicReading(reading),
    messages,
    imageUrl,
    detailedSections: reading.detailed_text
      ? parseDetailedReading(reading.detailed_text)
      : null,
  };

  return (
    <>
      <ShareHeader />
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <ReadingView initial={payload} shareId={id} readOnly />
      </main>
      <SiteFooter />
    </>
  );
}

function ShareHeader() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
      <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[rgba(217,178,94,0.4)] bg-[rgba(61,31,79,0.35)] text-base text-gold sm:h-9 sm:w-9 sm:text-lg">
          ✦
        </span>
        <span className="truncate font-serif text-lg tracking-wide text-cream sm:text-xl">
          Palmistica
        </span>
      </Link>
      {/* whitespace-nowrap: btn-ghost is inline-flex, which doesn't stop
       * its own text node from wrapping — this label wrapped to two lines
       * and collided with the logo on narrow screens without it. */}
      <Link
        href="/read"
        className="btn-ghost shrink-0 whitespace-nowrap !px-3 !py-1.5 text-[10px] uppercase tracking-[0.08em] sm:!px-5 sm:!py-2 sm:text-xs sm:tracking-[0.14em]"
      >
        Get your own reading
      </Link>
    </header>
  );
}
