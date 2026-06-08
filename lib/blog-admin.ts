import { createAdminClient } from "@/lib/supabase/admin";
import type { PostCategory } from "@/lib/blog-types";

export type BlogPostStatus = "draft" | "published";

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: PostCategory;
  cover_image: string | null;
  author: string | null;
  read_minutes: number | null;
  featured: boolean;
  status: BlogPostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogPostInput = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: PostCategory;
  cover_image?: string | null;
  read_minutes?: number;
  featured?: boolean;
  status?: BlogPostStatus;
  publish?: boolean;
};

const CATEGORIES: PostCategory[] = ["insight", "product", "client", "intelligence", "announcement"];

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function estimateReadMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function validateBlogInput(input: BlogPostInput): string | null {
  if (!input.title.trim()) return "Title is required.";
  if (!input.slug.trim()) return "Slug is required.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) return "Slug must be lowercase letters, numbers, and hyphens only.";
  if (!input.excerpt.trim()) return "Excerpt is required.";
  if (!CATEGORIES.includes(input.category)) return "Invalid category.";
  if (input.read_minutes != null && (input.read_minutes < 1 || input.read_minutes > 120)) {
    return "Read time must be between 1 and 120 minutes.";
  }
  return null;
}

export async function isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const supabase = createAdminClient();
  let q = supabase.from("blog_posts").select("id").eq("slug", slug);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.maybeSingle();
  return !!data;
}

export async function getAllBlogPostsAdmin(): Promise<BlogPostRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlogPostRow[];
}

export async function getBlogPostByIdAdmin(id: string): Promise<BlogPostRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as BlogPostRow | null) ?? null;
}

async function unsetOtherFeatured(excludeId?: string) {
  const supabase = createAdminClient();
  let q = supabase.from("blog_posts").update({ featured: false }).eq("featured", true);
  if (excludeId) q = q.neq("id", excludeId);
  await q;
}

export async function createBlogPost(input: BlogPostInput): Promise<{ post?: BlogPostRow; error?: string }> {
  const validation = validateBlogInput(input);
  if (validation) return { error: validation };
  if (await isSlugTaken(input.slug)) return { error: "That slug is already in use. Choose a different one." };

  const status: BlogPostStatus = input.publish || input.status === "published" ? "published" : (input.status ?? "draft");
  const published_at = status === "published" ? new Date().toISOString() : null;
  const featured = input.featured ?? false;

  if (featured) await unsetOtherFeatured();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      title: input.title.trim(),
      slug: input.slug.trim(),
      excerpt: input.excerpt.trim(),
      body: input.body,
      category: input.category,
      cover_image: input.cover_image?.trim() || null,
      author: "Segmiq",
      read_minutes: input.read_minutes ?? estimateReadMinutes(input.body),
      featured,
      status,
      published_at,
    })
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { post: data as BlogPostRow };
}

export async function updateBlogPost(id: string, input: BlogPostInput): Promise<{ post?: BlogPostRow; error?: string }> {
  const existing = await getBlogPostByIdAdmin(id);
  if (!existing) return { error: "Post not found." };

  const validation = validateBlogInput(input);
  if (validation) return { error: validation };
  if (await isSlugTaken(input.slug, id)) return { error: "That slug is already in use. Choose a different one." };

  let status: BlogPostStatus = input.status ?? existing.status;
  if (input.publish) status = "published";

  let published_at = existing.published_at;
  if (status === "published" && !published_at) {
    published_at = new Date().toISOString();
  }

  const featured = input.featured ?? existing.featured;
  if (featured) await unsetOtherFeatured(id);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      title: input.title.trim(),
      slug: input.slug.trim(),
      excerpt: input.excerpt.trim(),
      body: input.body,
      category: input.category,
      cover_image: input.cover_image?.trim() || null,
      read_minutes: input.read_minutes ?? estimateReadMinutes(input.body),
      featured,
      status,
      published_at,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { post: data as BlogPostRow };
}

export async function publishBlogPost(id: string): Promise<{ post?: BlogPostRow; error?: string }> {
  const existing = await getBlogPostByIdAdmin(id);
  if (!existing) return { error: "Post not found." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      status: "published",
      published_at: existing.published_at ?? new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { post: data as BlogPostRow };
}

export async function unpublishBlogPost(id: string): Promise<{ post?: BlogPostRow; error?: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .update({ status: "draft" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { post: data as BlogPostRow };
}

export async function deleteBlogPost(id: string): Promise<{ slug?: string; error?: string }> {
  const existing = await getBlogPostByIdAdmin(id);
  if (!existing) return { error: "Post not found." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) return { error: error.message };
  return { slug: existing.slug };
}
