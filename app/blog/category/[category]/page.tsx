/**
 * Category archive — blog.segmiq.com/category/<category>
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getPostsByCategory,
  getPublishedPosts,
  CATEGORY_LABELS,
  BLOG_CATEGORY_NAV,
  type PostCategory,
} from "@/lib/blog";
import PostCard from "@/components/blog/PostCard";
import NewsSidebar from "@/components/blog/NewsSidebar";
import { getBlogPathPrefix } from "@/lib/blog-links-server";
import { blogHomeHref, blogCategoryHref } from "@/lib/blog-links";

export const revalidate = 300;

const VALID_CATEGORIES = new Set<string>(["insight", "product", "client", "intelligence", "announcement"]);

export async function generateStaticParams() {
  return BLOG_CATEGORY_NAV.map(({ category }) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  if (!VALID_CATEGORIES.has(category)) return { title: "Section not found" };
  const label = CATEGORY_LABELS[category as PostCategory];
  return {
    title: label,
    description: `Latest ${label.toLowerCase()} stories from Segmiq Wire — trade tech news for Africa.`,
    alternates: { canonical: `https://blog.segmiq.com/category/${category}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!VALID_CATEGORIES.has(category)) notFound();

  const cat = category as PostCategory;
  const posts = await getPostsByCategory(cat);
  const allPosts = await getPublishedPosts();
  const trending = allPosts.slice(0, 5);

  const counts = Object.fromEntries(
    BLOG_CATEGORY_NAV.map(({ category: c }) => [c, allPosts.filter((p) => p.category === c).length])
  ) as Record<PostCategory, number>;

  const pathPrefix = getBlogPathPrefix();
  const homeHref = blogHomeHref(pathPrefix);

  const sidebarCategories = BLOG_CATEGORY_NAV.filter(({ category: c }) => counts[c] > 0).map(({ category: c, label }) => ({
    label,
    href: blogCategoryHref(c, pathPrefix),
    count: counts[c],
  }));

  const navLabel = BLOG_CATEGORY_NAV.find((n) => n.category === cat)?.label ?? CATEGORY_LABELS[cat];
  const [lead, ...rest] = posts;

  return (
    <>
      <section className="border-b border-black/[0.08] dark:border-white/10">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-8 sm:py-10">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#666] dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All stories
          </Link>
          <h1 className="text-[32px] sm:text-[40px] font-bold tracking-tight mt-6">{navLabel}</h1>
          <p className="mt-2 text-[15px] text-[#666] dark:text-white/50">
            {posts.length} {posts.length === 1 ? "story" : "stories"}
          </p>
        </div>
      </section>

      <section className="py-10 sm:py-12">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 grid lg:grid-cols-[minmax(0,1fr)_280px] gap-12 xl:gap-16">
          <div>
            {posts.length === 0 ? (
              <p className="text-[15px] text-[#888] dark:text-white/45 py-12 text-center">No stories in this section yet.</p>
            ) : (
              <>
                {lead ? (
                  <div className="mb-10 pb-10 border-b border-black/[0.08] dark:border-white/10">
                    <PostCard post={lead} variant="lead" />
                  </div>
                ) : null}
                {rest.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-10">
                    {rest.map((p) => (
                      <PostCard key={p.slug} post={p} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="lg:sticky lg:top-[88px] lg:self-start">
            <NewsSidebar trending={trending} categories={sidebarCategories} />
          </div>
        </div>
      </section>
    </>
  );
}
