import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { ReadingView } from "@/components/ReadingView";
import {
  getReading,
  getMessages,
  getSignedImageUrl,
  isUuid,
} from "@/lib/readings";
import type { ReadingPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/r/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) return { title: "Reading not found" };
  const reading = await getReading(id).catch(() => null);
  if (!reading || reading.status !== "complete") {
    return { title: "A palm reading" };
  }
  return {
    title: reading.hand_element
      ? `A ${reading.hand_element}-hand reading`
      : "A palm reading",
    description:
      "A palm reading from Palmara — the four major lines, the hand's element, and one warm reflection.",
  };
}

export default async function SharePage(props: PageProps<"/r/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();

  const reading = await getReading(id);
  if (!reading) notFound();

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

  const payload: ReadingPayload = { reading, messages, imageUrl };

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
    <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full border border-[rgba(217,178,94,0.4)] bg-[rgba(61,31,79,0.35)] text-lg text-gold">
          ✦
        </span>
        <span className="font-serif text-xl tracking-wide text-cream">
          Palmara
        </span>
      </Link>
      <Link href="/read" className="btn-ghost !px-5 !py-2 text-xs uppercase tracking-[0.14em]">
        Get your own reading
      </Link>
    </header>
  );
}
