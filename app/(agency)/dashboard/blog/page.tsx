import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { BlogManager } from "@/components/agency/BlogManager";
import { getAllBlogPostsAdmin } from "@/lib/blog-admin";

export const dynamic = "force-dynamic";

export default async function AgencyBlogPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  let posts: Awaited<ReturnType<typeof getAllBlogPostsAdmin>> = [];
  try {
    posts = await getAllBlogPostsAdmin();
  } catch {
    posts = [];
  }

  return (
    <AgencyLayout breadcrumb="PLATFORM / BLOG" pageTitle="Blog">
      <BlogManager initialPosts={posts} />
    </AgencyLayout>
  );
}
