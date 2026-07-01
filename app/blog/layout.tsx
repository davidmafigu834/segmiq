/**
 * Layout for Segmiq Wire (blog.segmiq.com). Served internally at /blog/* via middleware host rewrite.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import BlogHeader from "@/components/blog/BlogHeader";
import BlogFooter from "@/components/blog/BlogFooter";
import BreakingTicker from "@/components/blog/BreakingTicker";
import { BlogThemeProvider } from "@/components/blog/BlogThemeProvider";
import { BlogPathProvider } from "@/components/blog/BlogPathProvider";
import { BLOG_THEME_STORAGE_KEY, parseBlogTheme } from "@/lib/blog-theme";
import { getBlogPathPrefix } from "@/lib/blog-links-server";
import { blogCategoryHref } from "@/lib/blog-links";
import { BLOG_CATEGORY_NAV, getCategoryCounts, getPublishedPosts, MIN_SECTION_POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  metadataBase: new URL("https://blog.segmiq.com"),
  title: { default: "Segmiq Wire", template: "%s — Segmiq Wire" },
  description:
    "Trade tech news for Africa — product launches, market intelligence, and field insights for solar, construction, roofing, electrical, and landscaping.",
  alternates: { canonical: "https://blog.segmiq.com" },
  openGraph: { type: "website", siteName: "Segmiq Wire", url: "https://blog.segmiq.com" },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const [counts, posts] = await Promise.all([getCategoryCounts(), getPublishedPosts()]);
  const initialTheme = parseBlogTheme(cookies().get(BLOG_THEME_STORAGE_KEY)?.value);
  const pathPrefix = getBlogPathPrefix();

  const available = BLOG_CATEGORY_NAV.filter(({ category }) => counts[category] >= MIN_SECTION_POSTS).map(
    ({ category, label }) => ({ label, href: blogCategoryHref(category, pathPrefix) })
  );

  const tickerItems = posts.slice(0, 8).map((p) => ({ slug: p.slug, title: p.title }));
  const searchPosts = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    categoryLabel: p.categoryLabel,
    publishedAt: p.publishedAt,
  }));

  return (
    <BlogThemeProvider initialTheme={initialTheme}>
      <BlogPathProvider prefix={pathPrefix}>
        <div className="bg-white dark:bg-[#0a0a0a] text-[#0C0C0C] dark:text-white antialiased min-h-screen flex flex-col transition-colors">
          <BreakingTicker items={tickerItems} pathPrefix={pathPrefix} />
          <BlogHeader available={available} searchPosts={searchPosts} />
          <main className="flex-1">{children}</main>
          <BlogFooter pathPrefix={pathPrefix} />
        </div>
      </BlogPathProvider>
    </BlogThemeProvider>
  );
}
