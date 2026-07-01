/**
 * Post cards for the news site — default grid, horizontal feed, and compact list variants.
 */

import Link from "next/link";
import Image from "next/image";
import type { Post } from "@/lib/blog";
import { fmtDateShort } from "@/lib/blog-utils";
import { getBlogPathPrefix } from "@/lib/blog-links-server";
import { blogPostHref } from "@/lib/blog-links";
import CategoryBadge from "@/components/blog/CategoryBadge";
import RelativeTime from "@/components/blog/RelativeTime";

type Variant = "default" | "horizontal" | "compact" | "hero";

export default function PostCard({ post, variant = "default" }: { post: Post; variant?: Variant }) {
  const postHref = blogPostHref(post.slug, getBlogPathPrefix());

  if (variant === "horizontal") {
    return (
      <Link
        href={postHref}
        className="group flex gap-4 py-5 border-b border-black/[0.08] dark:border-white/10 last:border-0"
      >
        <div className="relative w-[120px] sm:w-[140px] shrink-0 aspect-[4/3] rounded-md overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="140px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 flex-1">
          <CategoryBadge category={post.category} label={post.categoryLabel} />
          <h3 className="text-[17px] sm:text-[18px] font-bold leading-snug mt-2 group-hover:underline underline-offset-2">
            {post.title}
          </h3>
          <p className="text-[14px] text-[#666] dark:text-white/55 mt-1.5 line-clamp-2 leading-relaxed hidden sm:block">{post.excerpt}</p>
          <div className="flex items-center gap-2 mt-2 text-[12px] text-[#888] dark:text-white/45">
            <RelativeTime iso={post.publishedAt} />
            {post.readMinutes ? (
              <>
                <span className="text-black/20 dark:text-white/20">·</span>
                <span>{post.readMinutes} min read</span>
              </>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        href={postHref}
        className="group block py-3 border-b border-black/[0.08] dark:border-white/10 last:border-0"
      >
        <CategoryBadge category={post.category} label={post.categoryLabel} />
        <h4 className="text-[15px] font-semibold leading-snug mt-1.5 group-hover:underline underline-offset-2">{post.title}</h4>
        <RelativeTime iso={post.publishedAt} className="text-[12px] text-[#888] dark:text-white/45 mt-1 block" />
      </Link>
    );
  }

  if (variant === "hero") {
    return (
      <Link href={postHref} className="group block">
        <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="(max-width:640px) 100vw, 300px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <CategoryBadge category={post.category} label={post.categoryLabel} />
        <h4 className="text-[16px] font-bold leading-snug mt-2.5 group-hover:underline underline-offset-2">{post.title}</h4>
        <div className="text-[12px] text-[#888] dark:text-white/45 mt-1.5">{fmtDateShort(post.publishedAt)}</div>
      </Link>
    );
  }

  return (
    <Link href={postHref} className="group block">
      <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-black/[0.06] dark:border-white/10">
        <Image
          src={post.coverImage}
          alt=""
          fill
          sizes="(max-width:640px) 100vw, 300px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <CategoryBadge category={post.category} label={post.categoryLabel} />
      <h4 className="text-[16px] font-bold leading-snug mt-2.5 group-hover:underline underline-offset-2">{post.title}</h4>
      <p className="text-[13px] text-[#666] dark:text-white/55 mt-1.5 line-clamp-2 leading-relaxed">{post.excerpt}</p>
      <RelativeTime iso={post.publishedAt} className="text-[12px] text-[#888] dark:text-white/45 mt-2 block" />
    </Link>
  );
}
