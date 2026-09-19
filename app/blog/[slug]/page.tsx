import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PalmMarkdown } from "@/components/PalmMarkdown";
import { getBlogPost, getBlogSlugs } from "@/lib/blog";

export const dynamicParams = false;

export function generateStaticParams() {
  return getBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: post.metaTitle,
    description: post.metaDescription,
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <>
      <SiteHeader />

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="eyebrow">Guides</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
          {post.title}
        </h1>

        <hr className="hairline my-8" />

        <PalmMarkdown>{post.body}</PalmMarkdown>

        <div className="mt-10 text-center">
          <Link href="/read" className="btn-gold">
            Begin your reading
          </Link>
        </div>

        <hr className="hairline my-10" />

        <p className="text-center text-xs text-cream-faint">
          <Link href="/blog" className="underline decoration-[rgba(217,178,94,0.4)] underline-offset-2 hover:text-gold">
            More guides
          </Link>
        </p>
      </main>

      <SiteFooter />

      {post.schema?.map((entry, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
    </>
  );
}
