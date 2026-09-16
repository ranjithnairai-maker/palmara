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

/**
 * Picks the first candidate that parses as an absolute URL, trying a bare
 * host (Vercel's env vars have no scheme) before an as-given value. Falls
 * back to localhost so a misconfigured env var never fails the build.
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
        return new URL(attempt);
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
    default: "Palmara — Read your palm",
    template: "%s · Palmara",
  },
  description:
    "Palmara reads your palm with the eye of a modern palmist — the four major lines, your hand's element, and one warm holistic reflection. Upload or snap a photo to begin.",
  openGraph: {
    title: "Palmara — Read your palm",
    description:
      "A modern palm reading grounded in real palmistry. Upload or snap a photo of your palm and ask the reader anything.",
    type: "website",
    siteName: "Palmara",
  },
  twitter: {
    card: "summary_large_image",
    title: "Palmara — Read your palm",
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
