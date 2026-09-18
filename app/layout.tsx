import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// A hostname with no dot (and isn't localhost) is never a real production
// domain — but new URL("https://" + candidate) happily "succeeds" on one
// anyway (e.g. a NEXT_PUBLIC_SITE_URL accidentally set to a bare path like
// "ranjithnairai-maker/palmara" parses as host "ranjithnairai-maker", path
// "/palmara"). That shipped to production once already: every absolute URL
// the app generated (canonical share links, OG/Twitter image URLs) pointed
// at an unreachable host, silently, because nothing here rejected it.
function looksLikeRealHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.includes(".");
}

/**
 * Picks the first candidate that parses as an absolute URL with a plausible
 * hostname, trying a bare host (Vercel's env vars have no scheme) before an
 * as-given value. Falls back to localhost so a misconfigured env var never
 * fails the build — but also never silently produces a broken URL when a
 * later candidate (Vercel's own auto-populated production URL) would work.
 */
function resolveSiteUrl(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const attempt of [candidate, `https://${candidate}`]) {
      try {
        const url = new URL(attempt);
        if (looksLikeRealHost(url.hostname)) return url;
      } catch {
        // try the next form / candidate
      }
    }
  }
  return new URL("http://localhost:3000");
}

const siteUrl = resolveSiteUrl();

export const viewport: Viewport = {
  themeColor: "#0B0A12",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Palmistica — Read your palm",
    template: "%s · Palmistica",
  },
  description:
    "Palmistica reads your palm with the eye of a modern palmist — the four major lines, your hand's element, and one warm holistic reflection. Upload or snap a photo to begin.",
  openGraph: {
    title: "Palmistica — Read your palm",
    description:
      "A modern palm reading grounded in real palmistry. Upload or snap a photo of your palm and ask the reader anything.",
    type: "website",
    siteName: "Palmistica",
  },
  twitter: {
    card: "summary_large_image",
    title: "Palmistica — Read your palm",
    description:
      "A modern palm reading grounded in real palmistry. Upload or snap a photo of your palm.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="mystic-bg" aria-hidden />
        <div className="mystic-vignette" aria-hidden />
        {children}
      </body>
    </html>
  );
}
