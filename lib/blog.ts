/**
 * Blog data layer.
 *
 * Reads published posts from Supabase when configured; falls back to SEED_POSTS
 * so the blog renders and builds before migration 040 is applied.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_LABELS, type Post, type PostCategory } from "@/lib/blog-types";

export type { Post, PostCategory } from "@/lib/blog-types";
export { CATEGORY_LABELS, FILTERS } from "@/lib/blog-types";

export const MIN_SECTION_POSTS = 2;

export const BLOG_CATEGORY_NAV: { category: PostCategory; label: string }[] = [
  { category: "insight", label: "Insights" },
  { category: "product", label: "Product" },
  { category: "client", label: "Customer Stories" },
  { category: "intelligence", label: "Intelligence" },
  { category: "announcement", label: "Announcements" },
];

const IMG = {
  solar: "https://images.unsplash.com/photo-1745187946672-2c1d8cf26a2b?q=70&w=900&h=560&fit=crop&auto=format",
  construction: "https://images.unsplash.com/photo-1646324554833-f0b6a479fa5d?q=70&w=900&h=560&fit=crop&auto=format",
  electrician: "https://images.unsplash.com/photo-1758101755915-462eddc23f57?q=70&w=900&h=560&fit=crop&auto=format",
  house: "https://images.unsplash.com/photo-1706808849802-8f876ade0d1f?q=70&w=900&h=560&fit=crop&auto=format",
  team: "https://images.unsplash.com/photo-1573164574572-cb89e39749b4?q=70&w=900&h=560&fit=crop&auto=format",
};

const P = (
  slug: string,
  title: string,
  excerpt: string,
  category: PostCategory,
  coverImage: string,
  readMinutes: number,
  publishedAt: string,
  featured = false
): Post => ({
  slug,
  title,
  excerpt,
  category,
  categoryLabel: CATEGORY_LABELS[category],
  coverImage,
  readMinutes,
  publishedAt,
  featured,
  author: "Segmiq",
  body: `${excerpt}\n\nThis is placeholder body copy for the Segmiq blog. Replace it with the real article — written in the NVIDIA editorial style: open with the most important fact, explain the mechanism in the middle, and close with what it means for the reader.\n\nKeep examples specific to construction, solar, roofing, electrical, and landscaping across Zimbabwe, Zambia, South Africa, and Kenya.`,
});

export const SEED_POSTS: Post[] = [
  P("segmiq-cloud-is-live", "Segmiq Cloud is live: document every project, win the next one", "Field workers upload site photos from a phone, every project gets a public share link and a milestone timeline, and a conversational form turns visitors into scored leads.", "announcement", IMG.solar, 5, "2026-06-08", true),
  P("first-five-minutes-solar", "Why the first five minutes decide most solar deals", "Response time, not price, is the strongest predictor of who wins the install. Here is what the timing data shows.", "insight", IMG.solar, 6, "2026-06-04"),
  P("thousand-leads-best-time-to-call", "What a thousand trade leads revealed about the best time to call", "The platform noticed a pattern across clients that no single business would have spotted on its own.", "intelligence", IMG.team, 7, "2026-05-30"),
  P("how-lead-scoring-works", "How Segmiq scores a lead 0–100 before a rep reads it", "A look at the rules-based engine — recency, budget, urgency, completeness, campaign fit — and where AI adds to it.", "product", IMG.electrician, 5, "2026-05-27"),
  P("leads-in-a-phone", "The hidden cost of leads living in a salesperson's phone", "When a rep leaves, what walks out with them — and why a shared timeline changes the maths.", "insight", IMG.construction, 4, "2026-05-21"),
  P("lusaka-roofing-response-time", "How a Lusaka roofing company cut response time from hours to minutes", "A look at the before and after when every enquiry routes and confirms automatically. (Illustrative example.)", "client", IMG.house, 5, "2026-05-16"),
  P("conversational-form", "Inside the conversational form that qualifies as it talks", "Why a chat-style intake beats a static form for trade enquiries, and what it captures along the way.", "product", IMG.solar, 4, "2026-05-12"),
  P("the-follow-up-gap", "The follow-up gap: where trade businesses lose contracts", "Most lost deals are not lost on price. They are lost in the silence after the first reply.", "intelligence", IMG.electrician, 6, "2026-05-07"),
  P("whatsapp-first", "WhatsApp-first: why African trade sales don't happen in email", "The channel where the deal actually lives — and why building your pipeline around it changes close rates.", "insight", IMG.team, 5, "2026-05-02"),
  P("scoring-on-every-plan", "Lead scoring now runs on every plan, including Starter", "A rules-based score on every lead from day one, with AI intent scoring on Growth and Scale.", "announcement", IMG.construction, 3, "2026-04-28"),
];

type BlogPostRow = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: PostCategory;
  cover_image: string | null;
  author: string | null;
  read_minutes: number | null;
  featured: boolean;
  published_at: string;
};

function sortNewest(a: Post, b: Post) {
  return b.publishedAt.localeCompare(a.publishedAt);
}

const ROW_TO_POST = (r: BlogPostRow): Post => ({
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt,
  body: r.body,
  category: r.category,
  categoryLabel: CATEGORY_LABELS[r.category],
  coverImage: r.cover_image ?? IMG.solar,
  author: r.author ?? "Segmiq",
  readMinutes: r.read_minutes ?? 5,
  featured: r.featured ?? false,
  publishedAt: r.published_at,
});

function supabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const supabaseImpl = {
  async getPublished(): Promise<Post[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ROW_TO_POST(r as BlogPostRow));
  },
};

async function fetchPublishedPosts(): Promise<Post[]> {
  if (!supabaseConfigured()) {
    return [...SEED_POSTS].sort(sortNewest);
  }
  try {
    return await supabaseImpl.getPublished();
  } catch {
    return [...SEED_POSTS].sort(sortNewest);
  }
}

export async function getPublishedPosts(): Promise<Post[]> {
  return fetchPublishedPosts();
}

export async function getCategoryCounts(): Promise<Record<PostCategory, number>> {
  const posts = await getPublishedPosts();
  const counts: Record<PostCategory, number> = {
    insight: 0,
    product: 0,
    client: 0,
    intelligence: 0,
    announcement: 0,
  };
  for (const p of posts) counts[p.category]++;
  return counts;
}

export async function getFeaturedPost(): Promise<Post | null> {
  const posts = await getPublishedPosts();
  return posts.find((p) => p.featured) ?? posts[0] ?? null;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const posts = await getPublishedPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

export async function getAllSlugs(): Promise<string[]> {
  const posts = await getPublishedPosts();
  return posts.map((p) => p.slug);
}

export async function getPostsByCategory(category: PostCategory): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.filter((p) => p.category === category);
}
