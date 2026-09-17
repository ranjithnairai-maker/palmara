import { OG_SIZE, renderReadingOgImage } from "@/lib/og-image";
import { isUuid } from "@/lib/readings";

// lib/readings.ts (imported transitively via lib/og-image.tsx) uses
// node:crypto for the owner-token check elsewhere in that module, which
// isn't Edge-compatible — nodejs runtime avoids that, and matches every
// other route in this app (Next.js also deprecated Edge in favor of
// nodejs for this kind of work).
export const runtime = "nodejs";
export const alt = "A palm reading from Palmistica";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderReadingOgImage(isUuid(id) ? id : null);
}
