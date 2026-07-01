"use client";

import { createContext, useContext } from "react";
import { blogHref } from "@/lib/blog-links";

type BlogPathContextValue = {
  prefix: string;
  home: string;
  post: (slug: string) => string;
  category: (cat: string) => string;
};

const BlogPathContext = createContext<BlogPathContextValue | null>(null);

export function BlogPathProvider({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  const value: BlogPathContextValue = {
    prefix,
    home: blogHref(prefix, "/"),
    post: (slug) => blogHref(prefix, `/${slug}`),
    category: (cat) => blogHref(prefix, `/category/${cat}`),
  };
  return <BlogPathContext.Provider value={value}>{children}</BlogPathContext.Provider>;
}

export function useBlogPath() {
  const ctx = useContext(BlogPathContext);
  if (!ctx) throw new Error("useBlogPath must be used within BlogPathProvider");
  return ctx;
}
