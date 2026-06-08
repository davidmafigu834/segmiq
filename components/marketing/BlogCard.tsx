/**
 * BlogCard — a single post card. Used by the blog index grid.
 */

import Link from "next/link";
import Image from "next/image";
import { Clock } from "lucide-react";
import type { Post } from "@/lib/blog-types";
import { m } from "@/components/marketing/marketingTheme";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function BlogCard({ post }: { post: Post }) {
  return (
    <Link href={`/blog/${post.slug}`} className={`group flex flex-col rounded-2xl overflow-hidden border ${m.border} bg-white/[0.03] transition-transform duration-300 hover:-translate-y-1`}>
      <div className="relative h-44 overflow-hidden">
        <Image src={post.coverImage} alt="" fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <span className="w-max text-[11px] tracking-[0.08em] font-bold uppercase text-[#D4FF4F] bg-[#0C0C0C] px-2 py-1 rounded">{post.categoryLabel}</span>
        <div className="mt-2 font-semibold leading-snug">{post.title}</div>
        <p className={`mt-1.5 text-sm ${m.muted}`}>{post.excerpt}</p>
        <div className={`mt-4 pt-3 border-t ${m.border} flex items-center gap-2 text-xs ${m.faint}`}>
          <span>{formatDate(post.publishedAt)}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-[13px] h-[13px]" /> {post.readMinutes} min read</span>
        </div>
      </div>
    </Link>
  );
}
