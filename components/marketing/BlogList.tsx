"use client";

/**
 * BlogList — category filter chips + the post grid. Client component (instant filtering).
 */

import { useState } from "react";
import BlogCard from "./BlogCard";
import { FILTERS, type Post, type PostCategory } from "@/lib/blog-types";

export default function BlogList({ posts }: { posts: Post[] }) {
  const [active, setActive] = useState<"all" | PostCategory>("all");
  const list = active === "all" ? posts : posts.filter((p) => p.category === active);

  return (
    <>
      <div className="flex flex-wrap gap-2 text-[13px] font-medium">
        {FILTERS.map((f) => {
          const on = active === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              className={`rounded-full px-4 py-1.5 border ${on ? "bg-[#0C0C0C] text-white border-[#0C0C0C]" : "border-black/[0.08] text-[#5b5b5b] hover:border-black/30 hover:text-black"}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {list.map((p) => <BlogCard key={p.slug} post={p} />)}
      </div>
      {list.length === 0 && <p className="text-[#5b5b5b] text-sm mt-6">No posts in this category yet.</p>}
    </>
  );
}
