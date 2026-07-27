import Link from "next/link";
import type { Post } from "@/lib/blog";
import { fmtDateShort } from "@/lib/blog-utils";
import { getBlogPathPrefix } from "@/lib/blog-links-server";
import { blogPostHref } from "@/lib/blog-links";

type CategoryLink = { label: string; href: string; count: number };

export default function NewsSidebar({
  trending,
  categories,
}: {
  trending: Post[];
  categories: CategoryLink[];
}) {
  const pathPrefix = getBlogPathPrefix();

  return (
    <aside className="space-y-10">
      {trending.length > 0 && (
        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#0C0C0C] dark:text-white mb-4">
            Trending
          </h3>
          <ol className="space-y-0">
            {trending.map((p, i) => (
              <li key={p.slug} className="border-b border-black/[0.08] dark:border-white/10 last:border-0">
                <Link href={blogPostHref(p.slug, pathPrefix)} className="group flex gap-3 py-3.5">
                  <span className="text-[18px] font-bold text-black/15 dark:text-white/20 leading-none w-5 shrink-0 tabular-nums group-hover:text-[#76B900] dark:group-hover:text-[#D4FF4F] transition-colors">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-semibold leading-snug tracking-tight group-hover:underline underline-offset-2 decoration-black/25 dark:decoration-white/30">
                      {p.title}
                    </h4>
                    <time dateTime={p.publishedAt} className="mt-1.5 block text-[11px] text-[#888] dark:text-white/40">
                      {fmtDateShort(p.publishedAt)}
                    </time>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="bg-[#0C0C0C] text-white p-6">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#D4FF4F]">Newsletter</h3>
        <p className="text-[14px] text-white/60 mt-2.5 leading-relaxed">
          Product updates, market data, and field insights — twice a month.
        </p>
        <form className="mt-5 space-y-2.5">
          <input
            type="email"
            required
            placeholder="you@company.co.zw"
            className="w-full bg-white/[0.06] border border-white/15 px-3.5 py-2.5 text-[13px] outline-none placeholder:text-white/35 focus:border-[#D4FF4F]/50 transition-colors"
          />
          <button
            type="submit"
            className="w-full bg-[#D4FF4F] text-black text-[13px] font-bold py-2.5 hover:bg-[#c8f040] transition-colors"
          >
            Subscribe
          </button>
        </form>
      </div>

      {categories.length > 0 && (
        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#0C0C0C] dark:text-white mb-3">
            Sections
          </h3>
          <nav>
            {categories.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="flex items-center justify-between py-2.5 text-[14px] text-[#444] dark:text-white/65 hover:text-[#76B900] dark:hover:text-[#D4FF4F] transition-colors border-b border-black/[0.06] dark:border-white/[0.06] last:border-0"
              >
                <span>{c.label}</span>
                <span className="text-[12px] text-[#aaa] dark:text-white/35 tabular-nums">{c.count}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </aside>
  );
}
