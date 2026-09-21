import { BLOG_POSTS_LIST } from "./blog-posts";

export interface BlogPost {
  slug: string;
  /** Rendered as the page's actual <h1> — not part of `body`. */
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** Markdown, heading levels already promoted so the top level here is h2
   * (the page's own <h1> comes from `title`, rendered separately). */
  body: string;
  /** JSON-LD objects for a <script type="application/ld+json"> tag, when
   * the content marketing plan specified concrete schema for this article.
   * Most articles don't have one yet — that's a deliberate follow-up, not
   * an oversight (see the blog feature handoff doc). */
  schema?: Record<string, unknown>[];
  /** Shows a quiet second line offering the $1 ebook below the reading CTA
   * — recommended on articles closest to "the next step after a free
   * reading" (the four hand-element pieces, the mounts piece), not all of
   * them, so it never reads as an upsell tacked onto every page. */
  offerEbook?: boolean;
}

export const BLOG_POSTS: BlogPost[] = BLOG_POSTS_LIST;

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getBlogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}
