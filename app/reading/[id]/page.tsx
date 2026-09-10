import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
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

export async function generateMetadata(props: PageProps<"/reading/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) return { title: "Reading not found" };
  const reading = await getReading(id).catch(() => null);
  if (!reading) return { title: "Reading not found" };
  return {
    title: reading.hand_element
      ? `A ${reading.hand_element}-hand reading`
      : "Your palm reading",
  };
}

export default async function ReadingPage(props: PageProps<"/reading/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();

  const reading = await getReading(id);
  if (!reading) notFound();

  const [messages, imageUrl] = await Promise.all([
    getMessages(id),
    reading.image_path && reading.image_path !== "pending"
      ? getSignedImageUrl(reading.image_path)
      : Promise.resolve(null),
  ]);

  const payload: ReadingPayload = { reading, messages, imageUrl };

  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <ReadingView initial={payload} shareId={id} />
      </main>
      <SiteFooter />
    </>
  );
}
