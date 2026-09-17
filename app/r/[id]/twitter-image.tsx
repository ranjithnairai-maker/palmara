import { OG_SIZE, renderReadingOgImage } from "@/lib/og-image";
import { isUuid } from "@/lib/readings";

// Some platforms (X/Twitter) look for twitter-image specifically even when
// Open Graph tags are present — same rendering logic as opengraph-image.tsx,
// factored into lib/og-image.tsx so both files just call it.
// See opengraph-image.tsx in this same segment for why nodejs, not edge.
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
