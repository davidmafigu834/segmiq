import { formatDistanceToNow } from "date-fns";
import type { PostCategory } from "@/lib/blog-types";

export function fmtRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export const CATEGORY_STYLES: Record<
  PostCategory,
  { bg: string; text: string; dot: string; ring: string }
> = {
  insight: {
    bg: "bg-sky-50 dark:bg-sky-950/60",
    text: "text-sky-800 dark:text-sky-300",
    dot: "bg-sky-500",
    ring: "ring-sky-200 dark:ring-sky-800",
  },
  product: {
    bg: "bg-violet-50 dark:bg-violet-950/60",
    text: "text-violet-800 dark:text-violet-300",
    dot: "bg-violet-500",
    ring: "ring-violet-200 dark:ring-violet-800",
  },
  client: {
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    text: "text-emerald-800 dark:text-emerald-300",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200 dark:ring-emerald-800",
  },
  intelligence: {
    bg: "bg-amber-50 dark:bg-amber-950/60",
    text: "text-amber-900 dark:text-amber-300",
    dot: "bg-amber-500",
    ring: "ring-amber-200 dark:ring-amber-800",
  },
  announcement: {
    bg: "bg-rose-50 dark:bg-rose-950/60",
    text: "text-rose-800 dark:text-rose-300",
    dot: "bg-rose-500",
    ring: "ring-rose-200 dark:ring-rose-800",
  },
};

export type SearchablePost = {
  slug: string;
  title: string;
  excerpt: string;
  categoryLabel: string;
  publishedAt: string;
};
