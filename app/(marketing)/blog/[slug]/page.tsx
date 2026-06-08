/**
 * Blog post — /blog/[slug]. Server component. Statically generated per slug, with
 * per-post metadata. Header/footer from the marketing layout.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Clock, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPostBySlug, getAllSlugs } from "@/lib/blog";

export const dynamicParams = true;
export const revalidate = 600;

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return { title: "Post not found — Segmiq" };
  return {
    title: `${post.title} — Segmiq Blog`,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, images: [post.coverImage], type: "article" },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  return (
    <article className="pt-12 pb-20">
      <div className="mx-auto max-w-[760px] px-5">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-[#5b5b5b] hover:text-black">
          <ArrowLeft className="w-4 h-4" /> All posts
        </Link>

        <div className="mt-6">
          <span className="text-[11px] tracking-[0.08em] font-bold uppercase text-[#D4FF4F] bg-[#0C0C0C] px-2 py-1 rounded">{post.categoryLabel}</span>
        </div>
        <h1 className="mt-4 text-[34px] sm:text-[44px] leading-[1.08] font-extrabold tracking-tight">{post.title}</h1>
        <div className="mt-4 flex items-center gap-3 text-[13px] text-[#8a8a8a]">
          <span>{post.author}</span><span>·</span>
          <span>{formatDate(post.publishedAt)}</span><span>·</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-[14px] h-[14px]" /> {post.readMinutes} min read</span>
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-5 mt-8">
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden ring-1 ring-black/[0.08]">
          <Image src={post.coverImage} alt="" fill sizes="(max-width:900px) 100vw, 900px" className="object-cover" priority />
        </div>
      </div>

      <div className="mx-auto max-w-[680px] px-5 mt-10">
        <div className="space-y-5 text-[17px] leading-[1.7] text-[#2b2b2b] [&_h2]:text-[26px] [&_h2]:font-extrabold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-[#0C0C0C] [&_a]:underline [&_a]:underline-offset-2 [&_img]:rounded-xl [&_blockquote]:border-l-4 [&_blockquote]:border-[#D4FF4F] [&_blockquote]:pl-4 [&_blockquote]:italic">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
        </div>

        <div className="mt-12 rounded-2xl bg-[#D4FF4F] p-8 text-center">
          <h3 className="text-[22px] font-extrabold text-black">See it on your own leads</h3>
          <p className="mt-2 text-sm text-black/70">Book a demo and we&apos;ll show you Segmiq working on a sample of your real enquiries.</p>
          <a href="#" className="inline-block mt-4 px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90">Book a demo</a>
        </div>
      </div>
    </article>
  );
}
