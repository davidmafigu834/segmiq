import Link from "next/link";
import type { PostCategory } from "@/lib/blog-types";

type Props = {
  category: PostCategory;
  label: string;
  href?: string;
  size?: "sm" | "md";
};

/** Editorial section label — text-forward, not a colorful chip. */
export default function CategoryBadge({ label, href, size = "sm" }: Props) {
  const cls = `inline-block font-bold uppercase tracking-[0.12em] text-[#76B900] dark:text-[#D4FF4F] ${
    size === "sm" ? "text-[11px]" : "text-[12px]"
  }`;

  if (href) {
    return (
      <Link href={href} className={`${cls} hover:underline underline-offset-2`}>
        {label}
      </Link>
    );
  }
  return <span className={cls}>{label}</span>;
}
