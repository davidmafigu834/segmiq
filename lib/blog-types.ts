export type PostCategory = "insight" | "product" | "client" | "intelligence" | "announcement";

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: PostCategory;
  categoryLabel: string;
  coverImage: string;
  author: string;
  readMinutes: number;
  featured: boolean;
  publishedAt: string;
};

export const CATEGORY_LABELS: Record<PostCategory, string> = {
  insight: "INSIGHT",
  product: "PRODUCT",
  client: "CLIENT OUTCOME",
  intelligence: "INTELLIGENCE",
  announcement: "ANNOUNCEMENT",
};

export const FILTERS: { key: "all" | PostCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "insight", label: "Insight" },
  { key: "product", label: "Product" },
  { key: "client", label: "Client outcomes" },
  { key: "intelligence", label: "Intelligence" },
  { key: "announcement", label: "Announcements" },
];
