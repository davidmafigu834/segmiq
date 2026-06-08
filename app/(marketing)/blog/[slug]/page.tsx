/**
 * Blog post — /blog/[slug]. Server component. Statically generated per slug, with
 * per-post metadata. Header/footer from the marketing layout.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Clock, ArrowLeft } from "lucide-react";
import { BlogMarkdown } from "@/components/blog/BlogMarkdown";
import JsonLd from "@/components/seo/JsonLd";
import { getPostBySlug, getAllSlugs } from "@/lib/blog";
import { articleLd, pageMetadata } from "@/lib/seo";
import { m } from "@/components/marketing/marketingTheme";
import { ML } from "@/lib/marketing-links";

export const dynamicParams = true;
export const revalidate = 600;

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return { title: "Post not found — Segmiq" };
  return pageMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${params.slug}`,
    images: [post.coverImage, `/blog/${params.slug}/opengraph-image`],
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  return (
    <article className="pt-12 pb-20">
      <JsonLd
        data={articleLd({
          title: post.title,
          description: post.excerpt,
          slug: post.slug,
          publishedAt: post.publishedAt,
          image: post.coverImage,
          author: post.author,
        })}
      />
      <div className="mx-auto max-w-[760px] px-5">
        <Link href="/blog" className={`inline-flex items-center gap-1.5 text-sm ${m.linkMuted}`}>
          <ArrowLeft className="w-4 h-4" /> All posts
        </Link>

        <div className="mt-6">
          <span className="text-[11px] tracking-[0.08em] font-bold uppercase text-[#D4FF4F] bg-[#0C0C0C] px-2 py-1 rounded">{post.categoryLabel}</span>
        </div>
        <h1 className="mt-4 text-[34px] sm:text-[44px] leading-[1.08] font-extrabold tracking-tight">{post.title}</h1>
        <div className={`mt-4 flex items-center gap-3 text-[13px] ${m.faint}`}>
          <span>{post.author}</span><span>·</span>
          <span>{formatDate(post.publishedAt)}</span><span>·</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-[14px] h-[14px]" /> {post.readMinutes} min read</span>
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-5 mt-8">
        <div className={`relative w-full aspect-[16/9] rounded-2xl overflow-hidden ring-1 ${m.ring}`}>
          <Image src={post.coverImage} alt="" fill sizes="(max-width:900px) 100vw, 900px" className="object-cover" priority />
        </div>
      </div>

      <div className="mx-auto max-w-[680px] px-5 mt-10">
        <BlogMarkdown body={post.body} />

        <div className="mt-12 rounded-2xl bg-[#D4FF4F] p-8 text-center">
          <h3 className="text-[22px] font-extrabold text-black">See it on your own leads</h3>
          <p className="mt-2 text-sm text-black/70">Book a demo and we&apos;ll show you Segmiq working on a sample of your real enquiries.</p>
          <a href={ML.contact} className="inline-block mt-4 px-6 py-3 rounded-full bg-black text-[#D4FF4F] font-semibold hover:opacity-90">Book a demo</a>
        </div>
      </div>
    </article>
  );
}
