import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { EbookSuccessClient } from "./EbookSuccessClient";

export const metadata: Metadata = {
  title: "Order received",
  robots: { index: false, follow: false },
};

export default function EbookSuccessPage() {
  return (
    <>
      <SiteHeader showCta={false} />
      <main className="relative z-10 mx-auto w-full max-w-md flex-1 px-6 py-16 text-center">
        <p className="eyebrow">Thank you</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight">
          Learn Palmistry Basics
        </h1>
        <Suspense
          fallback={
            <p className="mt-6 text-sm text-cream-muted">Checking your order…</p>
          }
        >
          <EbookSuccessClient />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
