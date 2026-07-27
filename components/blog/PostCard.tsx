/**
 * Editorial post cards for Segmiq Wire — NVIDIA-style news variants.
 */

import Link from "next/link";
import Image from "next/image";
import type { Post } from "@/lib/blog";
import { fmtDateShort } from "@/lib/blog-utils";
import { getBlogPathPrefix } from "@/lib/blog-links-server";
import { blogPostHref, blogCategoryHref } from "@/lib/blog-links";
import CategoryBadge from "@/components/blog/CategoryBadge";

type Variant = "default" | "horizontal" | "compact" | "hero" | "featured" | "side" | "lead" | "secondary" | "recent";

export default function PostCard({ post, variant = "default" }: { post: Post; variant?: Variant }) {
  const pathPrefix = getBlogPathPrefix();
  const postHref = blogPostHref(post.slug, pathPrefix);
  const catHref = blogCategoryHref(post.category, pathPrefix);

  if (variant === "featured") {
    return (
      <article className="group">
        <Link href={postHref} className="block relative aspect-[16/10] overflow-hidden bg-neutral-200 dark:bg-neutral-900">
          <Image
            src={post.coverImage}
            alt=""
            fill
            priority
            sizes="(max-width:1024px) 100vw, 720px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </Link>
        <div className="pt-5">
          <CategoryBadge category={post.category} label={post.categoryLabel} href={catHref} />
          <h2 className="mt-3 text-[28px] sm:text-[34px] lg:text-[38px] font-bold leading-[1.12] tracking-tight">
            <Link href={postHref} className="hover:underline underline-offset-4 decoration-black/25 dark:decoration-white/30">
              {post.title}
            </Link>
          </h2>
          <p className="mt-3 text-[16px] sm:text-[17px] text-[#555] dark:text-white/60 leading-relaxed line-clamp-3 max-w-[560px]">
            {post.excerpt}
          </p>
          <time dateTime={post.publishedAt} className="mt-4 block text-[13px] text-[#888] dark:text-white/40">
            {fmtDateShort(post.publishedAt)}
          </time>
        </div>
      </article>
    );
  }

  if (variant === "side") {
    return (
      <article className="group flex gap-4 py-4 first:pt-0 last:pb-0 border-b border-black/[0.08] dark:border-white/10 last:border-0">
        <Link href={postHref} className="relative w-[100px] sm:w-[120px] shrink-0 aspect-[4/3] overflow-hidden bg-neutral-200 dark:bg-neutral-900">
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="120px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </Link>
        <div className="min-w-0 flex-1 self-center">
          <h3 className="text-[15px] sm:text-[16px] font-semibold leading-snug tracking-tight">
            <Link href={postHref} className="hover:underline underline-offset-2 decoration-black/25 dark:decoration-white/30">
              {post.title}
            </Link>
          </h3>
          <time dateTime={post.publishedAt} className="mt-2 block text-[12px] text-[#888] dark:text-white/40">
            {fmtDateShort(post.publishedAt)}
          </time>
        </div>
      </article>
    );
  }

  if (variant === "lead") {
    return (
      <article className="group">
        <Link href={postHref} className="block relative aspect-[16/9] overflow-hidden bg-neutral-200 dark:bg-neutral-900">
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="(max-width:1024px) 100vw, 640px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </Link>
        <div className="pt-4">
          <h3 className="text-[22px] sm:text-[26px] font-bold leading-[1.15] tracking-tight">
            <Link href={postHref} className="hover:underline underline-offset-4 decoration-black/25 dark:decoration-white/30">
              {post.title}
            </Link>
          </h3>
          <p className="mt-2.5 text-[15px] text-[#555] dark:text-white/60 leading-relaxed line-clamp-2">{post.excerpt}</p>
          <time dateTime={post.publishedAt} className="mt-3 block text-[13px] text-[#888] dark:text-white/40">
            {fmtDateShort(post.publishedAt)}
          </time>
        </div>
      </article>
    );
  }

  if (variant === "secondary") {
    return (
      <article className="group py-4 border-t border-black/[0.08] dark:border-white/10 first:border-0 first:pt-0">
        <h4 className="text-[16px] sm:text-[17px] font-semibold leading-snug tracking-tight">
          <Link href={postHref} className="hover:underline underline-offset-2 decoration-black/25 dark:decoration-white/30">
            {post.title}
          </Link>
        </h4>
        <time dateTime={post.publishedAt} className="mt-2 block text-[12px] text-[#888] dark:text-white/40">
          {fmtDateShort(post.publishedAt)}
        </time>
      </article>
    );
  }

  if (variant === "recent") {
    return (
      <Link
        href={postHref}
        className="group flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-8 py-4 border-b border-black/[0.08] dark:border-white/10 last:border-0"
      >
        <h3 className="text-[16px] sm:text-[17px] font-semibold leading-snug tracking-tight group-hover:underline underline-offset-2 decoration-black/25 dark:decoration-white/30">
          {post.title}
        </h3>
        <time dateTime={post.publishedAt} className="shrink-0 text-[13px] text-[#888] dark:text-white/40 tabular-nums">
          {fmtDateShort(post.publishedAt)}
        </time>
      </Link>
    );
  }

  if (variant === "horizontal") {
    return (
      <Link href={postHref} className="group flex gap-5 py-6 border-b border-black/[0.08] dark:border-white/10 last:border-0">
        <div className="relative w-[128px] sm:w-[168px] shrink-0 aspect-[16/10] overflow-hidden bg-neutral-200 dark:bg-neutral-900">
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="168px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 flex-1 self-center">
          <CategoryBadge category={post.category} label={post.categoryLabel} />
          <h3 className="text-[17px] sm:text-[19px] font-bold leading-snug mt-2 tracking-tight group-hover:underline underline-offset-2 decoration-black/25 dark:decoration-white/30">
            {post.title}
          </h3>
          <p className="text-[14px] text-[#666] dark:text-white/55 mt-2 line-clamp-2 leading-relaxed hidden sm:block">{post.excerpt}</p>
          <time dateTime={post.publishedAt} className="mt-2.5 block text-[12px] text-[#888] dark:text-white/40">
            {fmtDateShort(post.publishedAt)}
          </time>
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href={postHref} className="group block py-3.5 border-b border-black/[0.08] dark:border-white/10 last:border-0">
        <h4 className="text-[15px] font-semibold leading-snug tracking-tight group-hover:underline underline-offset-2 decoration-black/25 dark:decoration-white/30">
          {post.title}
        </h4>
        <time dateTime={post.publishedAt} className="mt-1.5 block text-[12px] text-[#888] dark:text-white/40">
          {fmtDateShort(post.publishedAt)}
        </time>
      </Link>
    );
  }

  if (variant === "hero") {
    return (
      <Link href={postHref} className="group block">
        <div className="relative aspect-[16/10] overflow-hidden bg-neutral-200 dark:bg-neutral-900">
          <Image
            src={post.coverImage}
            alt=""
            fill
            sizes="(max-width:640px) 100vw, 300px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </div>
        <h4 className="text-[16px] font-bold leading-snug mt-3 tracking-tight group-hover:underline underline-offset-2 decoration-black/25 dark:decoration-white/30">
          {post.title}
        </h4>
        <time dateTime={post.publishedAt} className="mt-2 block text-[12px] text-[#888] dark:text-white/40">
          {fmtDateShort(post.publishedAt)}
        </time>
      </Link>
    );
  }

  return (
    <Link href={postHref} className="group block">
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-200 dark:bg-neutral-900">
        <Image
          src={post.coverImage}
          alt=""
          fill
          sizes="(max-width:640px) 100vw, 300px"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>
      <CategoryBadge category={post.category} label={post.categoryLabel} />
      <h4 className="text-[16px] sm:text-[17px] font-bold leading-snug mt-2.5 tracking-tight group-hover:underline underline-offset-2 decoration-black/25 dark:decoration-white/30">
        {post.title}
      </h4>
      <p className="text-[13px] text-[#666] dark:text-white/55 mt-1.5 line-clamp-2 leading-relaxed">{post.excerpt}</p>
      <time dateTime={post.publishedAt} className="mt-2.5 block text-[12px] text-[#888] dark:text-white/40">
        {fmtDateShort(post.publishedAt)}
      </time>
    </Link>
  );
}
