import Link from "next/link";
import { TrendingUp } from "lucide-react";
import type { Post } from "@/lib/blog";
import { getBlogPathPrefix } from "@/lib/blog-links-server";
import { blogPostHref } from "@/lib/blog-links";
import CategoryBadge from "@/components/blog/CategoryBadge";
import RelativeTime from "@/components/blog/RelativeTime";

function TrendingItem({ post, rank }: { post: Post; rank: number }) {
  const postHref = blogPostHref(post.slug, getBlogPathPrefix());
  return (
    <Link
      href={postHref}
      className="flex gap-3 group py-3 border-b border-black/[0.08] dark:border-white/10 last:border-0"
    >
      <span className="text-[22px] font-black text-black/10 dark:text-white/15 leading-none w-6 shrink-0 group-hover:text-[#D4FF4F] transition-colors">
        {rank}
      </span>
      <div className="min-w-0">
        <CategoryBadge category={post.category} label={post.categoryLabel} />
        <h4 className="text-[14px] font-semibold leading-snug mt-1.5 group-hover:underline underline-offset-2">{post.title}</h4>
        <RelativeTime iso={post.publishedAt} className="text-[11px] text-[#888] dark:text-white/45 mt-1 block" />
      </div>
    </Link>
  );
}

function SidebarNewsletter() {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-[#FAFAF8] dark:bg-[#141414] p-5">
      <h3 className="text-[15px] font-extrabold tracking-tight">The Wire</h3>
      <p className="text-[13px] text-[#666] dark:text-white/55 mt-1.5 leading-relaxed">
        Trade tech intelligence — product updates, market data, and field insights. Twice a month.
      </p>
      <form className="mt-4 space-y-2">
        <input
          type="email"
          required
          placeholder="you@company.co.zw"
          className="w-full rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-[13px] outline-none focus:border-black/25 dark:focus:border-white/30"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-[#0C0C0C] dark:bg-[#D4FF4F] text-white dark:text-black text-[13px] font-semibold py-2 hover:bg-black dark:hover:bg-[#c8f040] transition-colors"
        >
          Subscribe
        </button>
      </form>
    </div>
  );
}

type CategoryLink = { label: string; href: string; count: number };

export default function NewsSidebar({
  trending,
  categories,
}: {
  trending: Post[];
  categories: CategoryLink[];
}) {
  return (
    <aside className="space-y-6">
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-[#888] dark:text-white/45" />
          <h3 className="text-[13px] font-extrabold uppercase tracking-wider">Trending</h3>
        </div>
        <div>
          {trending.map((p, i) => (
            <TrendingItem key={p.slug} post={p} rank={i + 1} />
          ))}
        </div>
      </div>

      <SidebarNewsletter />

      {categories.length > 0 && (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-5">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wider mb-3">Sections</h3>
          <nav className="space-y-1">
            {categories.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="flex items-center justify-between py-2 text-[14px] text-[#444] dark:text-white/65 hover:text-black dark:hover:text-white transition-colors group"
              >
                <span className="group-hover:underline underline-offset-2">{c.label}</span>
                <span className="text-[12px] text-[#aaa] dark:text-white/35 font-mono">{c.count}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </aside>
  );
}
