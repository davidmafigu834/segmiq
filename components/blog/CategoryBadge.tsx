import Link from "next/link";
import type { PostCategory } from "@/lib/blog-types";
import { CATEGORY_STYLES } from "@/lib/blog-utils";

type Props = {
  category: PostCategory;
  label: string;
  href?: string;
  size?: "sm" | "md";
};

export default function CategoryBadge({ category, label, href, size = "sm" }: Props) {
  const s = CATEGORY_STYLES[category];
  const cls = `inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded ${s.bg} ${s.text} ${
    size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
  }`;

  const inner = (
    <>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${cls} hover:opacity-80 transition-opacity`}>
        {inner}
      </Link>
    );
  }
  return <span className={cls}>{inner}</span>;
}
