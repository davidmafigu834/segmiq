"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import BlogSearch from "@/components/blog/BlogSearch";
import ThemeToggle from "@/components/blog/ThemeToggle";
import { useBlogPath } from "@/components/blog/BlogPathProvider";
import type { SearchablePost } from "@/lib/blog-utils";

type NavItem = { label: string; href: string };

export default function BlogHeader({
  available = [],
  searchPosts = [],
}: {
  available?: NavItem[];
  searchPosts?: SearchablePost[];
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { home } = useBlogPath();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('[aria-label="Search articles"]')?.click();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md transition-[border-color,box-shadow] ${
        scrolled
          ? "border-b border-black/[0.08] dark:border-white/10 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="h-[64px] sm:h-[72px] flex items-center justify-between gap-4">
          <Link href={home} className="flex items-baseline gap-2.5 shrink-0 group">
            <SegmiqWordmark href="" size="md" theme="auto" />
            <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#0C0C0C] dark:text-white/90 border-l border-black/15 dark:border-white/20 pl-2.5 group-hover:text-[#76B900] dark:group-hover:text-[#D4FF4F] transition-colors">
              Wire
            </span>
          </Link>

          {available.length > 0 && (
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              <Link
                href={home}
                className="px-3.5 py-2 text-[13px] font-medium text-[#444] dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
              >
                Home
              </Link>
              {available.map((n) => (
                <Link
                  key={n.label}
                  href={n.href}
                  className="px-3.5 py-2 text-[13px] font-medium text-[#444] dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <BlogSearch posts={searchPosts} />
            <ThemeToggle />
            <Link
              href="/#subscribe"
              className="hidden md:inline-flex px-4 py-2 bg-[#0C0C0C] dark:bg-[#D4FF4F] text-white dark:text-black text-[13px] font-semibold hover:bg-black dark:hover:bg-[#c8f040] transition-colors"
            >
              Subscribe
            </Link>
            <button
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
              className="lg:hidden w-10 h-10 -mr-2 grid place-items-center text-[#444] dark:text-white/80"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {available.length > 0 && (
        <div
          className={`lg:hidden overflow-hidden transition-[max-height] duration-300 border-t border-black/[0.06] dark:border-white/10 bg-white dark:bg-[#0a0a0a] ${open ? "max-h-96" : "max-h-0"}`}
        >
          <nav className="mx-auto max-w-[1200px] px-4 sm:px-6 py-2 flex flex-col">
            <Link href={home} onClick={() => setOpen(false)} className="py-3 text-[15px] font-semibold border-b border-black/[0.06] dark:border-white/10">
              Home
            </Link>
            {available.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="py-3 text-[15px] font-medium border-b border-black/[0.06] dark:border-white/10 text-[#444] dark:text-white/70"
              >
                {n.label}
              </Link>
            ))}
            <Link href="/#subscribe" onClick={() => setOpen(false)} className="py-3 text-[15px] font-semibold">
              Subscribe
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
