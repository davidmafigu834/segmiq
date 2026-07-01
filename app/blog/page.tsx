/**
 * Segmiq Wire — tech news homepage (blog.segmiq.com/).
 */

import Link from "next/link";
import Image from "next/image";
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
import NewsSidebar from "@/components/blog/NewsSidebar";
import CategoryBadge from "@/components/blog/CategoryBadge";
import RelativeTime from "@/components/blog/RelativeTime";
import { getBlogPathPrefix } from "@/lib/blog-links-server";
import { blogPostHref, blogCategoryHref } from "@/lib/blog-links";

export const revalidate = 300;

const SECTION_ORDER: PostCategory[] = ["announcement", "product", "intelligence", "insight", "client"];

function HeroStory({ post, pathPrefix }: { post: Post; pathPrefix: string }) {
  return (
    <div className="group relative rounded-xl overflow-hidden bg-[#0C0C0C] min-h-[420px] sm:min-h-[480px]">
      <Link href={blogPostHref(post.slug, pathPrefix)} className="absolute inset-0 z-10" aria-label={post.title} />
      <Image
        src={post.coverImage}
        alt=""
        fill
        priority
        sizes="(max-width:1280px) 100vw, 1280px"
        className="object-cover opacity-70 transition-transform duration-700 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />
      <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-end max-w-[780px] pointer-events-none">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#D4FF4F] text-black text-[10px] font-extrabold uppercase tracking-wider">
            Top Story
          </span>
          <span className="pointer-events-auto">
            <CategoryBadge category={post.category} label={post.categoryLabel} href={blogCategoryHref(post.category, pathPrefix)} />
          </span>
        </div>
        <h1 className="text-[28px] sm:text-[40px] lg:text-[44px] font-extrabold leading-[1.08] tracking-tight text-white group-hover:underline underline-offset-4 decoration-white/40">
          {post.title}
        </h1>
        <p className="mt-3 text-[15px] sm:text-[17px] text-white/75 leading-relaxed line-clamp-2 max-w-[620px]">{post.excerpt}</p>
        <div className="mt-4 flex items-center gap-3 text-[13px] text-white/55">
          <span>{post.author}</span>
          <span>·</span>
          <RelativeTime iso={post.publishedAt} />
          {post.readMinutes ? (
            <>
              <span>·</span>
              <span>{post.readMinutes} min read</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-24 text-center text-[#888] dark:text-white/45">
        No stories yet — check back soon.
      </div>
    );
  }

  const featured = posts.find((p) => p.featured) ?? posts[0];
  const usedSlugs = new Set([featured.slug]);
  const topStories = posts.filter((p) => p.slug !== featured.slug).slice(0, 4);
  topStories.forEach((p) => usedSlugs.add(p.slug));

  const latestFeed = posts.filter((p) => !usedSlugs.has(p.slug)).slice(0, 8);
  latestFeed.forEach((p) => usedSlugs.add(p.slug));

  const trending = posts.slice(0, 5);

  const counts = Object.fromEntries(
    BLOG_CATEGORY_NAV.map(({ category }) => [category, posts.filter((p) => p.category === category).length])
  ) as Record<PostCategory, number>;

  const pathPrefix = getBlogPathPrefix();

  const sidebarCategories = BLOG_CATEGORY_NAV.filter(({ category }) => counts[category] > 0).map(({ category, label }) => ({
    label,
    href: blogCategoryHref(category, pathPrefix),
    count: counts[category],
  }));

  const categorySections = SECTION_ORDER.map((cat) => ({
    cat,
    list: pickCategoryList(posts, cat, usedSlugs),
  })).filter((s): s is { cat: PostCategory; list: Post[] } => s.list !== null);

  return (
    <>
      {/* Hero + top stories */}
      <section className="pt-6 pb-10">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <HeroStory post={featured} pathPrefix={pathPrefix} />
          {topStories.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#888] dark:text-white/45">Top Stories</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {topStories.map((p) => (
                  <PostCard key={p.slug} post={p} variant="hero" />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="border-t border-black/[0.10] dark:border-white/10" />
      </div>

      {/* Latest feed + sidebar */}
      <section className="py-10">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 grid lg:grid-cols-[1fr_320px] gap-10 xl:gap-14">
          <div>
            <div className="flex items-end justify-between mb-2">
              <h2 className="text-[26px] font-extrabold tracking-tight">Latest</h2>
              <span className="text-[13px] text-[#888] dark:text-white/45">{posts.length} stories</span>
            </div>
            <div>
              {(latestFeed.length > 0 ? latestFeed : posts.slice(1, 9)).map((p) => (
                <PostCard key={p.slug} post={p} variant="horizontal" />
              ))}
            </div>
          </div>
          <div className="lg:sticky lg:top-[120px] lg:self-start">
            <NewsSidebar trending={trending} categories={sidebarCategories} />
          </div>
        </div>
      </section>

      {/* Category sections */}
      {categorySections.map(({ cat, list }, idx) => (
        <section key={cat} id={cat} className={`py-10 scroll-mt-24 ${idx % 2 ? "bg-[#FAFAF8] dark:bg-[#111]" : ""}`}>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#888] dark:text-white/45">Section</span>
                <h2 className="text-[26px] font-extrabold tracking-tight mt-1">{CATEGORY_LABELS[cat]}</h2>
              </div>
              <Link
                href={blogCategoryHref(cat, pathPrefix)}
                className="text-[14px] font-semibold inline-flex items-center gap-1 text-[#444] dark:text-white/65 hover:text-black dark:hover:text-white transition-colors"
              >
                View all <ChevronRight className="w-[15px] h-[15px]" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-7">
              {list.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Newsletter */}
      <section id="subscribe" className="py-16 bg-[#0C0C0C] text-white scroll-mt-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#D4FF4F]">The Wire</span>
            <h2 className="mt-3 text-[32px] sm:text-[36px] font-extrabold leading-tight tracking-tight">
              Trade tech intelligence, delivered
            </h2>
            <p className="mt-4 text-[16px] text-white/65 leading-relaxed max-w-[480px]">
              Product launches, market data, and field insights for solar, construction, and trade businesses across Africa. No fluff.
            </p>
          </div>
          <form className="flex flex-col sm:flex-row gap-3 lg:justify-end">
            <input
              type="email"
              required
              className="flex-1 max-w-[360px] rounded-md bg-[#181818] border border-white/10 px-4 py-3 text-[14px] outline-none placeholder:text-white/35 focus:border-[#D4FF4F]/40"
              placeholder="you@company.co.zw"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-md bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040] transition-colors shrink-0"
            >
              Subscribe free
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
