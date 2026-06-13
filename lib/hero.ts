/**
 * Builds hero slides from blog posts: featured posts first, then most-recent to fill, capped.
 * Server-side (calls the blog data layer). The landing page renders <HeroSlider slides={...} />.
 *
 * Posts now live on the blog subdomain, so hrefs are ABSOLUTE to blog.segmiq.com (the hero is
 * on segmiq.com, a different host).
 */

import { getPublishedPosts } from "@/lib/blog";
import type { HeroSlide } from "@/components/marketing/HeroSlider";

const BLOG_URL = "https://blog.segmiq.com";

export async function getHeroSlides(limit = 5): Promise<HeroSlide[]> {
  const posts = await getPublishedPosts();
  const featured = posts.filter((p) => p.featured);
  const rest = posts.filter((p) => !p.featured);
  const chosen = [...featured, ...rest].slice(0, limit);

  return chosen.map((p) => ({
    category: p.categoryLabel,
    title: p.title,
    excerpt: p.excerpt,
    coverImage: p.coverImage,
    href: `${BLOG_URL}/${p.slug}`,
  }));
}
