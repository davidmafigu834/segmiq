import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import {
  deleteBlogPost,
  getBlogPostByIdAdmin,
  publishBlogPost,
  unpublishBlogPost,
  updateBlogPost,
  type BlogPostInput,
} from "@/lib/blog-admin";
import { revalidateBlogPaths } from "@/lib/blog-revalidate";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const post = await getBlogPostByIdAdmin(params.id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as BlogPostInput & { action?: "publish" | "unpublish" };

    if (body.action === "publish") {
      const existing = await getBlogPostByIdAdmin(params.id);
      const result = await publishBlogPost(params.id);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      revalidateBlogPaths(result.post?.slug);
      if (existing?.slug && existing.slug !== result.post?.slug) {
        revalidateBlogPaths(existing.slug);
      }
      return NextResponse.json(result.post);
    }

    if (body.action === "unpublish") {
      const existing = await getBlogPostByIdAdmin(params.id);
      const result = await unpublishBlogPost(params.id);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      revalidateBlogPaths(existing?.slug);
      return NextResponse.json(result.post);
    }

    const existing = await getBlogPostByIdAdmin(params.id);
    const result = await updateBlogPost(params.id, body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    revalidateBlogPaths(result.post?.slug);
    if (existing?.slug && existing.slug !== result.post?.slug) {
      revalidateBlogPaths(existing.slug);
    }
    return NextResponse.json(result.post);
  } catch (err) {
    console.error("[blog PATCH]", err);
    return NextResponse.json({ error: "Failed to update post." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const existing = await getBlogPostByIdAdmin(params.id);
  const result = await deleteBlogPost(params.id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  revalidateBlogPaths(result.slug ?? existing?.slug);
  return NextResponse.json({ ok: true });
}
