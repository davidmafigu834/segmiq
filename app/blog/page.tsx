/**
 * Blog homepage (blog.segmiq.com/). NVIDIA-style: Featured block + Recent News sidebar +
 * per-category section rows. Server component; pulls from the blog data layer.
 */

import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { getPublishedPosts, CATEGORY_LABELS, MIN_SECTION_POSTS, type Post, type PostCategory } from "@/lib/blog";
import PostCard from "@/components/blog/PostCard";

export const revalidate = 300;

const SECTION_ORDER: PostCategory[] = ["insight", "product", "client", "intelligence", "announcement"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function pickRecent(others: Post[], featuredRow: Post[], cap = 5): Post[] {
  const featuredRowSlugs = new Set(featuredRow.map((p) => p.slug));
  const preferred = others.filter((p) => !featuredRowSlugs.has(p.slug));
  const result = preferred.slice(0, cap);
  if (result.length >= cap) return result;
  const used = new Set(result.map((p) => p.slug));
  for (const p of others) {
    if (result.length >= cap) break;
    if (!used.has(p.slug)) {
      result.push(p);
      used.add(p.slug);
    }
  }
  return result;
}

function pickCategoryList(
  posts: Post[],
  cat: PostCategory,
  featured: Post,
  featuredRow: Post[]
): Post[] | null {
  const featuredRowSlugs = new Set(featuredRow.map((p) => p.slug));
  const inCategory = posts.filter((p) => p.category === cat && p.slug !== featured.slug);
  const strict = inCategory.filter((p) => !featuredRowSlugs.has(p.slug));
  const list = strict.length >= MIN_SECTION_POSTS ? strict : inCategory;
  if (list.length < MIN_SECTION_POSTS) return null;
  return list.slice(0, 4);
}

function FeaturedLarge({ post }: { post: Post }) {
  return (
    <Link href={`/${post.slug}`} className="group block mt-6">
      <div className="grid sm:grid-cols-2 gap-6 items-center">
        <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-neutral-100 border border-black/[0.06]">
          <Image src={post.coverImage} alt="" fill priority sizes="(max-width:1024px) 100vw, 560px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        </div>
        <div>
          <span className="inline-block text-[11px] font-semibold bg-[#f1f0ec] text-[#333] rounded-md px-2.5 py-[3px]">{post.categoryLabel}</span>
          <h3 className="text-[24px] font-bold leading-snug mt-3 group-hover:text-black">{post.title}</h3>
          <p className="text-[14px] text-[#5b5b5b] mt-2">{post.excerpt}</p>
          <div className="text-[13px] text-[#8a8a8a] mt-3">{fmtDate(post.publishedAt)}</div>
        </div>
      </div>
    </Link>
  );
}

function RecentItem({ post }: { post: Post }) {
  return (
    <Link href={`/${post.slug}`} className="block py-3.5 group">
      <span className="inline-block text-[11px] font-semibold bg-[#f1f0ec] text-[#333] rounded-md px-2.5 py-[3px]">{post.categoryLabel}</span>
      <div className="text-[15px] font-semibold leading-snug mt-1.5 group-hover:text-black">{post.title}</div>
      <div className="text-[12px] text-[#8a8a8a] mt-1">{fmtDate(post.publishedAt)}</div>
    </Link>
  );
}

export default async function BlogHome() {
  const posts = await getPublishedPosts();
  if (!posts.length) {
    return <div className="mx-auto max-w-[1180px] px-6 py-24 text-center text-[#8a8a8a]">No posts yet — check back soon.</div>;
  }

  const featured = posts.find((p) => p.featured) ?? posts[0];
  const others = posts.filter((p) => p !== featured);
  const featuredRow = others.slice(0, 3);
  const recent = pickRecent(others, featuredRow, 5);

  const categorySections = SECTION_ORDER.map((cat) => ({
    cat,
    list: pickCategoryList(posts, cat, featured, featuredRow),
  })).filter((s): s is { cat: PostCategory; list: Post[] } => s.list !== null);

  return (
    <>
      {/* Featured + Recent */}
      <section className="pt-10 pb-12">
        <div className="mx-auto max-w-[1180px] px-6 grid lg:grid-cols-[1fr_320px] gap-10">
          <div>
            <h2 className="text-[30px] font-extrabold tracking-tight">Featured</h2>
            <FeaturedLarge post={featured} />
            <div className="grid sm:grid-cols-3 gap-6 mt-8">
              {featuredRow.map((p) => <PostCard key={p.slug} post={p} />)}
            </div>
          </div>
          <aside className="lg:border-l lg:border-black/[0.10] lg:pl-8">
            <h3 className="text-[20px] font-extrabold tracking-tight">Recent News</h3>
            <div className="mt-5 divide-y divide-black/[0.10]">
              {recent.map((p) => <RecentItem key={p.slug} post={p} />)}
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-6"><div className="border-t border-black/[0.10]" /></div>

      {/* Category sections */}
      {categorySections.map(({ cat, list }, idx) => (
        <section key={cat} id={cat} className={`py-12 scroll-mt-20 ${idx % 2 ? "bg-[#FAFAF8]" : ""}`}>
          <div className="mx-auto max-w-[1180px] px-6">
            <div className="flex items-end justify-between">
              <h2 className="text-[26px] font-extrabold tracking-tight">{CATEGORY_LABELS[cat]}</h2>
              <Link href={`/#${cat}`} className="text-[14px] font-semibold inline-flex items-center gap-1">
                View all <ChevronRight className="w-[15px] h-[15px] text-[#9bbf2e]" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-7">
              {list.map((p) => <PostCard key={p.slug} post={p} />)}
            </div>
          </div>
        </section>
      ))}

      {/* Newsletter */}
      <section id="subscribe" className="py-16 bg-[#0C0C0C] text-white mt-6 scroll-mt-20">
        <div className="mx-auto max-w-[680px] px-6 text-center">
          <h2 className="text-[28px] font-extrabold leading-tight">One useful idea, every other week</h2>
          <p className="mt-3 text-[15px] text-white/70">Specific writing on capturing and closing trade leads in Africa. No fluff, no spam.</p>
          <form className="mt-6 flex flex-col sm:flex-row gap-3 max-w-[460px] mx-auto">
            <input type="email" required className="flex-1 rounded-full bg-[#181818] border border-white/10 px-4 py-3 text-[14px] outline-none placeholder:text-white/40" placeholder="you@company.co.zw" />
            <button type="submit" className="px-6 py-3 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">Subscribe</button>
          </form>
        </div>
      </section>
    </>
  );
}
