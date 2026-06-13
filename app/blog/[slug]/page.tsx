/**
 * Blog post page — blog.segmiq.com/<slug> (internally /blog/<slug>).
 * Canonical points to the blog host. "All posts" + category links are root-relative.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getPostBySlug, getAllSlugs, getPublishedPosts } from "@/lib/blog";
import { BlogMarkdown } from "@/components/blog/BlogMarkdown";
import PostCard from "@/components/blog/PostCard";

export const revalidate = 300;

const BLOG_URL = "https://blog.segmiq.com";

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post not found" };
  const url = `${BLOG_URL}/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: post.title, description: post.excerpt, publishedTime: post.publishedAt },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const related = (await getPublishedPosts())
    .filter((p) => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3);

  return (
    <>
      <article className="mx-auto max-w-[760px] px-6 pt-10 pb-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[14px] text-[#5b5b5b] hover:text-black">
          <ArrowLeft className="w-4 h-4" /> All posts
        </Link>

        <header className="mt-6">
          <Link href={`/#${post.category}`} className="inline-block text-[11px] font-semibold bg-[#f1f0ec] text-[#333] rounded-md px-2.5 py-[3px]">{post.categoryLabel}</Link>
          <h1 className="mt-4 text-[34px] sm:text-[42px] leading-[1.1] font-extrabold tracking-tight">{post.title}</h1>
          <p className="mt-4 text-[17px] text-[#5b5b5b] leading-relaxed">{post.excerpt}</p>
          <div className="mt-4 text-[13px] text-[#8a8a8a]">{fmtDate(post.publishedAt)}{post.readMinutes ? ` · ${post.readMinutes} min read` : ""}</div>
        </header>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-neutral-100 mt-8">
          <Image src={post.coverImage} alt="" fill priority sizes="(max-width:760px) 100vw, 760px" className="object-cover" />
        </div>

        <div className="mt-8">
          <BlogMarkdown body={post.body} variant="blog" />
        </div>
      </article>

      {/* CTA */}
      <section className="border-t border-black/[0.10]">
        <div className="mx-auto max-w-[760px] px-6 py-12">
          <div className="rounded-2xl bg-[#0C0C0C] text-white p-8 text-center">
            <h2 className="text-[22px] font-bold">See Segmiq on your own leads</h2>
            <p className="mt-2 text-[14px] text-white/70">A short demo on a week of your real enquiries.</p>
            <a href="https://segmiq.com/contact" className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">Book a demo <ArrowRight className="w-4 h-4" /></a>
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="bg-[#FAFAF8] py-12">
          <div className="mx-auto max-w-[1180px] px-6">
            <h2 className="text-[22px] font-extrabold tracking-tight">More in {post.categoryLabel}</h2>
            <div className="grid sm:grid-cols-3 gap-6 mt-7">
              {related.map((p) => <PostCard key={p.slug} post={p} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
