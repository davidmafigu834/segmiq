import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { createBlogPost, getAllBlogPostsAdmin, type BlogPostInput } from "@/lib/blog-admin";
import { revalidateBlogPaths } from "@/lib/blog-revalidate";

export async function GET() {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const posts = await getAllBlogPostsAdmin();
    return NextResponse.json(posts);
  } catch (err) {
    console.error("[blog GET]", err);
    return NextResponse.json({ error: "Failed to load posts." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = (await req.json()) as BlogPostInput;
    const result = await createBlogPost(body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    if (result.post?.status === "published") {
      revalidateBlogPaths(result.post.slug);
    }
    return NextResponse.json(result.post, { status: 201 });
  } catch (err) {
    console.error("[blog POST]", err);
    return NextResponse.json({ error: "Failed to create post." }, { status: 500 });
  }
}
