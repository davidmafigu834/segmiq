/**
 * Article page — blog.segmiq.com/<slug>
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { getPostBySlug, getAllSlugs, getPublishedPosts, BLOG_CATEGORY_NAV } from "@/lib/blog";
import { fmtDateLong } from "@/lib/blog-utils";
import { BlogMarkdown } from "@/components/blog/BlogMarkdown";
import PostCard from "@/components/blog/PostCard";
import CategoryBadge from "@/components/blog/CategoryBadge";
import ShareButtons from "@/components/blog/ShareButtons";
import ReadingProgress from "@/components/blog/ReadingProgress";
import NewsSidebar from "@/components/blog/NewsSidebar";
import RelativeTime from "@/components/blog/RelativeTime";
import type { PostCategory } from "@/lib/blog-types";
import { getBlogPathPrefix } from "@/lib/blog-links-server";
import { blogHomeHref, blogCategoryHref } from "@/lib/blog-links";

export const revalidate = 300;

const BLOG_URL = "https://blog.segmiq.com";

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Story not found" };
  const url = `${BLOG_URL}/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: post.title, description: post.excerpt, publishedTime: post.publishedAt },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const allPosts = await getPublishedPosts();
  const related = allPosts.filter((p) => p.category === post.category && p.slug !== post.slug).slice(0, 3);
  const trending = allPosts.filter((p) => p.slug !== post.slug).slice(0, 5);

  const counts = Object.fromEntries(
    BLOG_CATEGORY_NAV.map(({ category }) => [category, allPosts.filter((p) => p.category === category).length])
  ) as Record<PostCategory, number>;

  const pathPrefix = getBlogPathPrefix();
  const homeHref = blogHomeHref(pathPrefix);

  const sidebarCategories = BLOG_CATEGORY_NAV.filter(({ category }) => counts[category] > 0).map(({ category, label }) => ({
    label,
    href: blogCategoryHref(category, pathPrefix),
    count: counts[category],
  }));

  const articleUrl = `${BLOG_URL}/${post.slug}`;

  return (
    <>
      <ReadingProgress />

      {/* Article header band */}
      <div className="border-b border-black/[0.08] dark:border-white/10 bg-[#FAFAF8] dark:bg-[#111]">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-6 pb-8">
          <Link href={homeHref} className="inline-flex items-center gap-1.5 text-[13px] text-[#666] dark:text-white/55 hover:text-black dark:hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> All stories
          </Link>

          <header className="mt-6 max-w-[780px]">
            <CategoryBadge category={post.category} label={post.categoryLabel} href={blogCategoryHref(post.category, pathPrefix)} size="md" />
            <h1 className="mt-4 text-[32px] sm:text-[42px] lg:text-[46px] leading-[1.08] font-extrabold tracking-tight">{post.title}</h1>
            <p className="mt-4 text-[17px] sm:text-[19px] text-[#555] dark:text-white/65 leading-relaxed">{post.excerpt}</p>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-5 border-t border-black/[0.08] dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0C0C0C] dark:bg-[#D4FF4F] text-white dark:text-black grid place-items-center text-[13px] font-bold">
                  {post.author.charAt(0)}
                </div>
                <div>
                  <div className="text-[14px] font-semibold">{post.author}</div>
                  <div className="text-[12px] text-[#888] dark:text-white/45 flex items-center gap-2 mt-0.5">
                    <span>{fmtDateLong(post.publishedAt)}</span>
                    <span className="text-black/20 dark:text-white/20">·</span>
                    <RelativeTime iso={post.publishedAt} />
                    {post.readMinutes ? (
                      <>
                        <span className="text-black/20 dark:text-white/20">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {post.readMinutes} min read
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
              <ShareButtons url={articleUrl} title={post.title} />
            </div>
          </header>
        </div>
      </div>

      {/* Article body + sidebar */}
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_320px] gap-10 xl:gap-14">
        <article>
          <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900 mb-8">
            <Image src={post.coverImage} alt="" fill priority sizes="(max-width:900px) 100vw, 900px" className="object-cover" />
          </div>
          <BlogMarkdown body={post.body} variant="blog" />
        </article>

        <div className="lg:sticky lg:top-[120px] lg:self-start space-y-6">
          <NewsSidebar trending={trending} categories={sidebarCategories} />
        </div>
      </div>

      {/* CTA */}
      <section className="border-t border-black/[0.08] dark:border-white/10 bg-[#FAFAF8] dark:bg-[#111]">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12">
          <div className="rounded-xl bg-[#0C0C0C] text-white p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D4FF4F]">Segmiq</span>
              <h2 className="mt-2 text-[22px] sm:text-[26px] font-bold">See Segmiq on your own leads</h2>
              <p className="mt-2 text-[14px] text-white/65 max-w-[420px]">A short demo on a week of your real enquiries — solar, construction, roofing, and more.</p>
            </div>
            <a
              href="https://segmiq.com/contact"
              className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-md bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040] transition-colors shrink-0"
            >
              Book a demo <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="py-12 border-t border-black/[0.08] dark:border-white/10">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
            <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#888] dark:text-white/45">Related</h2>
            <p className="text-[22px] font-extrabold tracking-tight mt-1">More in {post.categoryLabel}</p>
            <div className="grid sm:grid-cols-3 gap-6 mt-7">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
