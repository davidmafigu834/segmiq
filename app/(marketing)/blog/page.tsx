/**
 * Blog index — /blog. Server component; fetches posts from lib/blog and passes them to
 * the client BlogList for instant category filtering. Header/footer from the marketing layout.
 */

import Link from "next/link";
import Image from "next/image";
import { Clock, ArrowRight } from "lucide-react";
import { getPublishedPosts, getFeaturedPost } from "@/lib/blog";
import BlogList from "@/components/marketing/BlogList";
import MarketingSubscribeForm from "@/components/marketing/MarketingSubscribeForm";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { m } from "@/components/marketing/marketingTheme";

export const revalidate = 600;

export const metadata = pageMetadata({
  title: "Blog",
  description: "Specific, useful writing for owners and directors in construction, solar, roofing, electrical, and landscaping across Africa.",
  path: "/blog",
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function BlogIndexPage() {
  const [posts, featured] = await Promise.all([getPublishedPosts(), getFeaturedPost()]);
  const rest = featured ? posts.filter((p) => p.slug !== featured.slug) : posts;

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }])} />
      <section className="pt-16 pb-8">
        <div className="mx-auto max-w-[1100px] px-5 max-w-[760px]">
          <div className={m.kicker}>BLOG</div>
          <h1 className="mt-3 text-[38px] sm:text-[48px] leading-[1.06] font-extrabold tracking-tight">Ideas on winning trade work in Africa</h1>
          <p className={`mt-4 text-base ${m.muted} max-w-[560px]`}>Specific, useful writing for owners and directors in construction, solar, roofing, electrical, and landscaping — what the data shows, and what to do about it.</p>
        </div>
      </section>

      {featured && (
        <section className="pb-10">
          <div className="mx-auto max-w-[1100px] px-5">
            <Link href={`/blog/${featured.slug}`} className={`group grid lg:grid-cols-2 rounded-2xl overflow-hidden border ${m.border} bg-white/[0.03] transition-shadow duration-300 hover:shadow-[0_18px_44px_rgba(0,0,0,0.4)]`}>
              <div className="relative h-[260px] lg:h-auto overflow-hidden">
                <Image src={featured.coverImage} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="p-7 lg:p-9 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] tracking-[0.08em] font-bold uppercase text-[#D4FF4F] bg-[#0C0C0C] px-2 py-1 rounded">{featured.categoryLabel}</span>
                  <span className={`text-xs ${m.faint}`}>Featured</span>
                </div>
                <h2 className="mt-3 text-[26px] sm:text-[30px] font-extrabold leading-tight">{featured.title}</h2>
                <p className={`mt-3 text-[15px] ${m.muted}`}>{featured.excerpt}</p>
                <div className={`mt-4 flex items-center gap-3 text-[13px] ${m.faint}`}>
                  <span>{formatDate(featured.publishedAt)}</span><span>·</span>
                  <span className="inline-flex items-center gap-1"><Clock className="w-[14px] h-[14px]" /> {featured.readMinutes} min read</span>
                </div>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#D4FF4F] bg-[#0C0C0C] px-3 py-1.5 rounded-full w-max">Read the post <ArrowRight className="w-[15px] h-[15px]" /></span>
              </div>
            </Link>
          </div>
        </section>
      )}

      <section className="pb-16">
        <div className="mx-auto max-w-[1100px] px-5">
          <BlogList posts={rest} />
        </div>
      </section>

      <section className={`py-14 ${m.sectionBand}`}>
        <div className="mx-auto max-w-[680px] px-5 text-center">
          <h2 className="text-[28px] font-extrabold leading-tight">One useful idea, every other week</h2>
          <p className={`mt-3 text-[15px] ${m.muted}`}>No fluff and no spam — just specific writing on capturing and closing trade leads in Africa.</p>
          <MarketingSubscribeForm
            subject="Blog newsletter"
            className="mt-6 flex flex-col sm:flex-row gap-3 max-w-[460px] mx-auto"
          />
        </div>
      </section>
    </>
  );
}
