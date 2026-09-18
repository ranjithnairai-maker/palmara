import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PalmMarkdown } from "@/components/PalmMarkdown";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Palmistica collects, how it's used, and how long it's kept.",
};

const PRIVACY_BODY = `
## What We Collect

**The photo you upload or capture.** This is the core input for generating your reading. We do not require an account, name, or email address to use Palmistica.

**Your reading and any follow-up chat messages.** The structured analysis, the generated reading text, and any questions you ask in the follow-up chat are stored so your reading and its shareable link continue to work.

**A random owner token.** When you create a reading, a random token is generated and stored in your browser (not tied to your identity) so you, and only you, can later delete that reading. We don't know who you are, only that whoever holds that token created that specific reading.

**Basic technical data.** Like most websites, our hosting and infrastructure providers (Vercel, Supabase) may log standard technical information (such as IP address and request metadata) for security and reliability purposes, as part of their own standard infrastructure logging.

**Payment information, if you choose to tip.** If you choose to send a tip, payment is handled entirely by Stripe through a Stripe Payment Link. We never see or store your card details. Stripe's own privacy policy governs that transaction.

## How We Use It

To generate your palm reading (your photo is sent to our AI provider, OpenRouter, solely to produce the analysis), to display your reading and power the follow-up chat, to make your shareable link work, and to keep the service running securely.

We do not sell your data, and we do not use your photo or reading for advertising or profiling.

## Sharing and Third Parties

Your reading is accessible to anyone who has your specific share link (palmistica.com/r/[id]). We do not index these pages for search engines, but anyone with the link can view the reading, so only share it with people you're comfortable seeing it.

We share data with the following providers, solely to operate the service: **OpenRouter** (processes your photo to generate the AI reading), **Supabase** (hosts our database and file storage), **Vercel** (hosts the application), and **Stripe** (processes voluntary tips, if you choose to send one). We do not sell data to advertisers or data brokers.

## How Long We Keep Your Data

**Your uploaded photo is automatically deleted after 90 days.** After that, your reading page shows a placeholder in place of the image, but the text of your reading remains.

**The text of your reading is kept indefinitely**, unless you delete it yourself (see below), so that your shareable link continues to work over time.

**You can delete your entire reading at any time**, using the "Delete this reading" control on your reading's page (this only works from the browser that created it, since it relies on the owner token described above). Deleting removes the photo, the reading, and any chat history permanently. If you've lost access to the browser that created your reading and need it deleted, contact us at ranjithnair.ai@gmail.com.

## Your Rights

Depending on where you live, you may have rights to access, correct, or delete your personal data, or to object to certain processing. Since Palmistica doesn't collect accounts or identifying information beyond what's described above, the owner-token deletion described above is the primary way to exercise these rights directly; for anything else, contact us at ranjithnair.ai@gmail.com.

## Children's Privacy

Palmistica is not intended for children under 13, and we do not knowingly collect data from children under 13. If you believe a child has used the service, contact us at ranjithnair.ai@gmail.com and we will remove the relevant data.

## Security

We take reasonable measures to protect your data, but no method of transmission or storage is completely secure, and we can't guarantee absolute security.

## Changes to This Policy

We may update this policy from time to time. Material changes will be reflected by updating the "Last updated" date above.

## Contact

Questions about this policy or your data can be sent to ranjithnair.ai@gmail.com.
`.trim();

export default function PrivacyPolicyPage() {
  return (
    <>
      <SiteHeader />

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-cream-faint">Last updated: September 18, 2026</p>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-cream-muted">
          Palmistica (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;Palmistica&rdquo;) provides
          free, AI-generated palm readings at palmistica.com. This policy explains what
          information we collect, how we use it, and the choices you have.
        </p>

        <hr className="hairline my-8" />

        <PalmMarkdown>{PRIVACY_BODY}</PalmMarkdown>
      </main>

      <SiteFooter />
    </>
  );
}
