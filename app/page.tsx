import Link from "next/link";
import { PalmGlyph } from "@/components/PalmGlyph";
import { Starfield } from "@/components/Starfield";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const STEPS = [
  {
    numeral: "I",
    title: "Capture",
    body: "Upload a photo of your open palm, or take one now with your camera. Preview it, retake until it feels right.",
  },
  {
    numeral: "II",
    title: "Contemplate",
    body: "Palmistica studies your hand's shape and its four major lines, reading length, depth, curve, and break the way a palmist would.",
  },
  {
    numeral: "III",
    title: "Converse",
    body: "Sit with your reading, then ask anything — your heart line and love, your head line and work, the mounts, the smaller lines.",
  },
];

const LINES = [
  {
    name: "The Life Line",
    body: "Vitality, rootedness, and how you move through change — not the length of your days.",
  },
  {
    name: "The Heart Line",
    body: "How you love and are loved: openly or guardedly, with the head or the whole chest.",
  },
  {
    name: "The Head Line",
    body: "The texture of your thinking — steady and deliberate, or quick, wide-ranging, restless.",
  },
  {
    name: "The Fate Line",
    body: "Direction and drive. Often faint or missing entirely, which is its own kind of freedom.",
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="relative mx-auto grid w-full max-w-5xl items-center gap-10 px-6 pt-10 pb-24 md:grid-cols-[1.05fr_0.95fr] md:pt-20 md:pb-32">
          <Starfield className="-z-10" />

          <div className="animate-fade-up">
            <p className="eyebrow">Modern palmistry</p>
            <h1 className="mt-5 font-serif text-[2.7rem] leading-[1.08] tracking-tight sm:text-6xl">
              <span className="text-gilt">Your hands have</span>
              <br />
              <span className="text-gilt">been keeping notes.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-cream-muted">
              Palmistica reads your palm with the eye of a modern palmist — your
              hand&rsquo;s element, the four major lines, and one warm reflection
              that ties them together. Then it stays to answer your questions.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/read" className="btn-gold">
                Begin your reading
              </Link>
              <a
                href="#how"
                className="text-sm tracking-wide text-cream-faint underline-offset-4 transition-colors hover:text-gold"
              >
                How it works
              </a>
              <Link href="/ebook" className="btn-ghost !px-4 !py-2 text-xs">
                Ebook
              </Link>
            </div>

            <p className="mt-6 text-xs tracking-wide text-cream-faint">
              No account. No sign-up. Your reading lives at its own private link.
            </p>
          </div>

          {/* Palm focal element */}
          <div className="relative mx-auto flex max-w-xs items-center justify-center md:max-w-none">
            <div
              aria-hidden
              className="absolute h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(217,178,94,0.22),transparent_70%)] blur-2xl animate-candle"
            />
            <PalmGlyph className="relative w-60 animate-float sm:w-72" />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-5xl px-6 py-16 scroll-mt-24">
          <div className="mb-12 text-center">
            <p className="eyebrow">The rite</p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl">Three quiet steps</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((step) => (
              <article key={step.numeral} className="mystic-card p-7">
                <span className="font-serif text-2xl text-gold">{step.numeral}</span>
                <h3 className="mt-3 font-serif text-xl text-cream">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-muted">
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* What Palmistica reads */}
        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <div className="mystic-card overflow-hidden">
            <div className="grid gap-10 p-8 sm:p-12 md:grid-cols-[0.8fr_1.2fr] md:items-center">
              <div>
                <p className="eyebrow">What it looks at</p>
                <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
                  Grounded in the old craft
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-cream-muted">
                  Every reading names your hand&rsquo;s element — Earth, Air, Fire,
                  or Water — then walks the four major lines, blending their
                  traditional meaning with what your photo actually shows. Mounts,
                  finger shape, and the minor lines are saved for the conversation
                  that follows.
                </p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {LINES.map((line) => (
                  <li
                    key={line.name}
                    className="rounded-xl border border-[rgba(217,178,94,0.14)] bg-[rgba(11,10,18,0.5)] p-4"
                  >
                    <p className="font-serif text-lg text-gold-bright">{line.name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-cream-muted">
                      {line.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto w-full max-w-5xl px-6 py-20 text-center">
          <div className="relative mx-auto max-w-2xl">
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(217,178,94,0.18),transparent_70%)] blur-2xl animate-candle"
            />
            <h2 className="relative font-serif text-3xl leading-tight sm:text-5xl">
              <span className="text-gilt">Hold your hand to the light.</span>
            </h2>
            <p className="relative mx-auto mt-5 max-w-md text-sm leading-relaxed text-cream-muted">
              It takes a minute. What it stirs up can stay with you longer.
            </p>
            <div className="relative mt-9">
              <Link href="/read" className="btn-gold">
                Begin your reading
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
