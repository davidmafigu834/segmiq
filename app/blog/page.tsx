/**
 * Segmiq Wire — SaaS tech news homepage (blog.segmiq.com/).
 * Editorial layout inspired by NVIDIA Blog: Featured + Recent News + topic sections.
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getPublishedPosts,
  CATEGORY_LABELS,
  BLOG_CATEGORY_NAV,
  MIN_SECTION_POSTS,
  type Post,
  type PostCategory,
} from "@/lib/blog";
import PostCard from "@/components/blog/PostCard";
import { getBlogPathPrefix } from "@/lib/blog-links-server";
import { blogCategoryHref } from "@/lib/blog-links";

export const dynamic = "force-dynamic";

const SECTION_ORDER: PostCategory[] = ["announcement", "product", "intelligence", "insight", "client"];

function pickCategoryList(
  posts: Post[],
  cat: PostCategory,
  usedSlugs: Set<string>
): Post[] | null {
  const list = posts.filter((p) => p.category === cat && !usedSlugs.has(p.slug));
  if (list.length < MIN_SECTION_POSTS) return null;
  return list.slice(0, 4);
}

export default async function BlogHome() {
  const posts = await getPublishedPosts();
  if (!posts.length) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-24 text-center text-[#888] dark:text-white/45">
        No stories yet — check back soon.
      </div>
    );
  }

  const featured = posts.find((p) => p.featured) ?? posts[0];
  const sideStories = posts.filter((p) => p.slug !== featured.slug).slice(0, 3);

  // Recent News excludes the featured block so the page doesn't repeat the same top stories.
  const featuredBlock = new Set([featured.slug, ...sideStories.map((p) => p.slug)]);
  const recentNews = posts.filter((p) => !featuredBlock.has(p.slug)).slice(0, 6);

  const pathPrefix = getBlogPathPrefix();

  // Topic sections may reuse posts (NVIDIA-style) — only skip the featured hero slug for variety.
  const heroOnly = new Set([featured.slug]);
  const categorySections = SECTION_ORDER.map((cat) => ({
    cat,
    list: pickCategoryList(posts, cat, heroOnly),
  })).filter((s): s is { cat: PostCategory; list: Post[] } => s.list !== null);

  return (
    <>
      {/* Featured — NVIDIA-style: large lead + stacked side stories */}
      <section className="pt-10 sm:pt-14 pb-12 sm:pb-16">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="flex items-baseline justify-between mb-7 sm:mb-8">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#0C0C0C] dark:text-white">
              Featured
            </h2>
            <span className="hidden sm:block h-px flex-1 mx-6 bg-black/[0.08] dark:bg-white/10" aria-hidden />
          </div>

          <div className="grid lg:grid-cols-[1.55fr_1fr] gap-8 lg:gap-10 xl:gap-14">
            <PostCard post={featured} variant="featured" />
            {sideStories.length > 0 && (
              <div className="lg:border-l lg:border-black/[0.08] dark:lg:border-white/10 lg:pl-8 xl:pl-10 flex flex-col justify-start">
                {sideStories.map((p) => (
                  <PostCard key={p.slug} post={p} variant="side" />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Recent News — clean chronological list */}
      {(recentNews.length > 0 || posts.length > 1) && (
        <section className="pb-14 sm:pb-16">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#0C0C0C] dark:text-white">
                Recent News
              </h2>
              <span className="hidden sm:block h-px flex-1 mx-6 bg-black/[0.08] dark:bg-white/10" aria-hidden />
            </div>
            <div className="mt-2">
              {(recentNews.length > 0 ? recentNews : posts.filter((p) => p.slug !== featured.slug).slice(0, 6)).map(
                (p) => (
                  <PostCard key={p.slug} post={p} variant="recent" />
                )
              )}
            </div>
          </div>
        </section>
      )}

      {/* Topic sections — lead story + secondary headlines */}
      {categorySections.map(({ cat, list }) => {
        const [lead, ...rest] = list;
        const navLabel = BLOG_CATEGORY_NAV.find((n) => n.category === cat)?.label ?? CATEGORY_LABELS[cat];
        return (
          <section
            key={cat}
            id={cat}
            className="py-12 sm:py-14 border-t border-black/[0.08] dark:border-white/10 scroll-mt-24"
          >
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
              <div className="flex items-end justify-between gap-4 mb-7 sm:mb-8">
                <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight">{navLabel}</h2>
                <Link
                  href={blogCategoryHref(cat, pathPrefix)}
                  className="text-[13px] sm:text-[14px] font-semibold inline-flex items-center gap-0.5 text-[#555] dark:text-white/55 hover:text-[#76B900] dark:hover:text-[#D4FF4F] transition-colors shrink-0"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12">
                {lead ? <PostCard post={lead} variant="lead" /> : null}
                <div className="flex flex-col justify-start lg:pt-1">
                  {rest.map((p) => (
                    <PostCard key={p.slug} post={p} variant="secondary" />
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* Newsletter */}
      <section id="subscribe" className="scroll-mt-24 border-t border-black/[0.08] dark:border-white/10">
        <div className="bg-[#0C0C0C] text-white">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D4FF4F]">Newsletter</span>
              <h2 className="mt-3 text-[28px] sm:text-[34px] font-bold leading-[1.15] tracking-tight max-w-[480px]">
                Trade tech intelligence, delivered
              </h2>
              <p className="mt-4 text-[15px] sm:text-[16px] text-white/55 leading-relaxed max-w-[440px]">
                Product launches, market data, and field insights for solar, construction, and trade businesses across Africa.
              </p>
            </div>
            <form className="flex flex-col sm:flex-row gap-3 lg:justify-end">
              <input
                type="email"
                required
                className="flex-1 max-w-[360px] bg-white/[0.06] border border-white/15 px-4 py-3.5 text-[14px] outline-none placeholder:text-white/35 focus:border-[#D4FF4F]/50 transition-colors"
                placeholder="you@company.co.zw"
              />
              <button
                type="submit"
                className="px-7 py-3.5 bg-[#D4FF4F] text-black text-[14px] font-bold hover:bg-[#c8f040] transition-colors shrink-0"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
