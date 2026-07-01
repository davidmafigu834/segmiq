import Link from "next/link";
import { Zap } from "lucide-react";
import { blogHref } from "@/lib/blog-links";

type TickerItem = { slug: string; title: string };

export default function BreakingTicker({ items, pathPrefix = "" }: { items: TickerItem[]; pathPrefix?: string }) {
  if (!items.length) return null;

  const doubled = [...items, ...items];

  return (
    <div className="bg-[#0C0C0C] text-white border-b border-white/10 overflow-hidden">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 flex items-stretch min-h-[36px]">
        <div className="flex items-center gap-1.5 shrink-0 pr-4 border-r border-white/10">
          <Zap className="w-3.5 h-3.5 text-[#D4FF4F] fill-[#D4FF4F]" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#D4FF4F] whitespace-nowrap">
            Latest
          </span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="flex animate-ticker hover:[animation-play-state:paused]">
            {doubled.map((item, i) => (
              <Link
                key={`${item.slug}-${i}`}
                href={blogHref(pathPrefix, `/${item.slug}`)}
                className="shrink-0 px-5 py-2 text-[13px] text-white/85 hover:text-white whitespace-nowrap transition-colors"
              >
                <span className="text-white/30 mr-2">·</span>
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
