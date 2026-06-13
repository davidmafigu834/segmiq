/**
 * Medium post card — used in the featured row and category sections.
 * Links are root-relative (`/<slug>`) because posts live at blog.segmiq.com/<slug>.
 */

import Link from "next/link";
import Image from "next/image";
import type { Post } from "@/lib/blog";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/${post.slug}`} className="group block">
      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-neutral-100">
        <Image src={post.coverImage} alt="" fill sizes="(max-width:640px) 100vw, 280px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <span className="inline-block mt-3 text-[11px] font-semibold bg-[#f1f0ec] text-[#333] rounded-md px-2.5 py-[3px]">{post.categoryLabel}</span>
      <h4 className="text-[15px] font-semibold leading-snug mt-2 group-hover:text-black text-[#1a1a1a]">{post.title}</h4>
      <div className="text-[12px] text-[#8a8a8a] mt-2">{fmtDate(post.publishedAt)}</div>
    </Link>
  );
}
