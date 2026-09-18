import { ImageResponse } from "next/og";
import { getReadingOgData } from "./readings";

export const OG_SIZE = { width: 1200, height: 630 } as const;

const FALLBACK_HEADLINE = "A palm reading, written for one hand only.";
const GONE_HEADLINE = "This reading is no longer available.";

// Reading content is immutable once generated (until the owner deletes it),
// so cache aggressively — long enough to be "aggressive," short enough
// that a deletion (rare) isn't stuck forever behind a stale cached
// preview. This route reads live data (a Supabase query per request), so
// Next's own static-route caching doesn't apply and everything here rides
// on response headers instead. Vercel strips shared-cache directives
// (s-maxage, stale-while-revalidate) out of a plain Cache-Control header
// before it reaches the client — confirmed in production, every request
// including repeats came back X-Vercel-Cache: MISS despite this route
// setting s-maxage — so the actual CDN-edge cache duration has to go on
// Vercel's own CDN-Cache-Control / Vercel-CDN-Cache-Control headers
// instead; Cache-Control here is just the plain browser-facing hint.
// Slow crawlers (LinkedIn's has a notably short fetch timeout) hitting an
// uncached cold render is a real failure mode this fixes, not just a
// performance nicety.
const EDGE_CACHE = "public, s-maxage=31536000, stale-while-revalidate=86400";
const RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=3600",
  "CDN-Cache-Control": EDGE_CACHE,
  "Vercel-CDN-Cache-Control": EDGE_CACHE,
};

let fontPromise: Promise<ArrayBuffer> | null = null;

/**
 * next/og (built on Satori) needs the font as a raw ArrayBuffer — it can't
 * use next/font or a linked Google Fonts stylesheet. Satori also needs an
 * actual TTF/OTF file, not WOFF2, and Google only serves TTF to browsers
 * old enough to predate WOFF2 support — hence the spoofed user-agent. This
 * fetch only ever happens once per server instance (module-scope cache).
 */
function loadHeadlineFont(): Promise<ArrayBuffer> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const css = await fetch(
        "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36",
          },
        },
      ).then((res) => res.text());
      const match = css.match(/src: url\(([^)]+)\)/);
      if (!match) throw new Error("Could not resolve a Playfair Display font URL");
      const fontRes = await fetch(match[1]);
      return fontRes.arrayBuffer();
    })();
  }
  return fontPromise;
}

// Simplified palm-line motif — decorative only, never the user's actual
// photo. Deliberate: keeps the preview fast, privacy-safe, and unaffected
// by the 90-day photo-retention prune (see lib/readings.ts pruneExpiredImages).
function PalmMotif() {
  return (
    <svg
      width="170"
      height="220"
      viewBox="0 0 240 320"
      style={{ opacity: 0.4 }}
    >
      <path
        d="M170 150 C 140 132, 100 130, 74 150"
        stroke="#d9b25e"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M72 176 C 104 196, 138 198, 172 186"
        stroke="#d9b25e"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M80 152 C 66 178, 70 220, 100 258"
        stroke="#d9b25e"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M120 256 C 120 220, 120 190, 124 158"
        stroke="#d9b25e"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// A unicode glyph like ✦ isn't in Playfair Display's character set, and
// satori (the ImageResponse renderer) has no OS-level font fallback to
// silently cover the gap — it renders as a tofu box instead. An inline SVG
// shape sidesteps the whole font-coverage question.
function SparkleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
        fill="#d9b25e"
      />
    </svg>
  );
}

function Frame({ headline }: { headline: string }) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "64px 96px",
        backgroundColor: "#0b0a12",
        backgroundImage:
          "radial-gradient(circle at 50% 0%, rgba(61,31,79,0.6), transparent 60%), radial-gradient(circle at 88% 92%, rgba(217,178,94,0.12), transparent 55%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 999,
            border: "1.5px solid rgba(217,178,94,0.5)",
            backgroundColor: "rgba(61,31,79,0.35)",
          }}
        >
          <SparkleGlyph />
        </div>
        <div
          style={{
            display: "flex",
            color: "#f3eee4",
            fontSize: 26,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          Palmistica
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          maxWidth: 920,
        }}
      >
        <PalmMotif />
        <div
          style={{
            display: "flex",
            fontFamily: "Playfair Display",
            fontSize: headline.length > 70 ? 48 : 58,
            lineHeight: 1.25,
            color: "#f3eee4",
            textAlign: "center",
          }}
        >
          {headline}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 24,
          color: "#d9b25e",
          letterSpacing: 1,
        }}
      >
        Get your free reading → palmistica.com
      </div>
    </div>
  );
}

async function render(headline: string): Promise<ImageResponse> {
  const fontData = await loadHeadlineFont();
  return new ImageResponse(<Frame headline={headline} />, {
    ...OG_SIZE,
    fonts: [{ name: "Playfair Display", data: fontData, weight: 700, style: "normal" }],
    headers: RESPONSE_HEADERS,
  });
}

/** Renders the share-preview image for a reading id, or a generic branded
 * "no longer available" image if it doesn't exist / isn't viewable (e.g.
 * the owner deleted it) — never a broken image or a 500 for a social
 * crawler hitting a dead link. Callers should pass `null` for a
 * malformed/non-UUID id rather than querying with it. */
export async function renderReadingOgImage(id: string | null): Promise<ImageResponse> {
  const data = id ? await getReadingOgData(id).catch(() => null) : null;
  if (!data) return render(GONE_HEADLINE);
  return render(data.headline || FALLBACK_HEADLINE);
}
