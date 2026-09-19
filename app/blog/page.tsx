import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BLOG_POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Plain-language guides to palm reading — the four major lines, the four hand elements, and how an AI reading actually works.",
};

export default function BlogIndexPage() {
  return (
    <>
      <SiteHeader />

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <p className="eyebrow">Guides</p>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl">
          A little grounding before you begin
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-cream-muted">
          The traditional meaning behind each major line, each hand element,
          and the mounts, plus an honest look at what an AI reading can and
          can&rsquo;t actually tell you.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {BLOG_POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="mystic-card block p-7 transition-transform hover:-translate-y-0.5"
            >
              <h2 className="font-serif text-xl text-cream">{post.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-cream-muted">
                {post.metaDescription}
              </p>
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
