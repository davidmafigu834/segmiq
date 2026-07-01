"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { SearchablePost } from "@/lib/blog-utils";
import { fmtRelative } from "@/lib/blog-utils";
import { useBlogPath } from "@/components/blog/BlogPathProvider";

export default function BlogSearch({ posts }: { posts: SearchablePost[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { post: postHref } = useBlogPath();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return posts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.categoryLabel.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [posts, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search articles"
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border border-black/10 dark:border-white/15 text-[13px] text-[#666] dark:text-white/55 hover:border-black/20 dark:hover:border-white/25 hover:text-black dark:hover:text-white transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search</span>
        <kbd className="hidden md:inline text-[10px] bg-black/[0.04] dark:bg-white/[0.08] px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search articles"
        className="sm:hidden w-9 h-9 grid place-items-center text-[#666] dark:text-white/55 hover:text-black dark:hover:text-white"
      >
        <Search className="w-[18px] h-[18px]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative mx-auto mt-[12vh] max-w-[560px] px-4">
            <div className="bg-white dark:bg-[#141414] rounded-xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden">
              <div className="flex items-center gap-3 px-4 border-b border-black/[0.08] dark:border-white/10">
                <Search className="w-4 h-4 text-[#888] dark:text-white/45 shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search stories, topics, announcements…"
                  className="flex-1 py-3.5 text-[15px] outline-none bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close search"
                  className="p-1 text-[#888] dark:text-white/45 hover:text-black dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {query.trim() && results.length === 0 && (
                  <p className="px-4 py-8 text-center text-[14px] text-[#888] dark:text-white/45">No stories match &ldquo;{query}&rdquo;</p>
                )}
                {results.map((p) => (
                  <Link
                    key={p.slug}
                    href={postHref(p.slug)}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06] last:border-0 hover:bg-[#FAFAF8] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#888] dark:text-white/45">{p.categoryLabel}</div>
                    <div className="text-[15px] font-semibold mt-0.5 leading-snug">{p.title}</div>
                    <div className="text-[12px] text-[#888] dark:text-white/45 mt-1">{fmtRelative(p.publishedAt)}</div>
                  </Link>
                ))}
                {!query.trim() && (
                  <p className="px-4 py-6 text-[13px] text-[#888] dark:text-white/45">Type to search all published stories</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
