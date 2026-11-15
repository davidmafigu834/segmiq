import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { BlogManager } from "@/components/agency/BlogManager";
import { RecordFrame } from "@/components/platform/workbench";
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
      <RecordFrame
        detail="A post is the record. Publish it only when the draft is finished."
        fact={{
          name: posts.length ? `${posts.length} posts are on the register.` : "No post is on the register.",
          detail: "A new post starts as a draft.",
          action: "New post",
          href: "/dashboard/blog/new",
        }}
      >
        <BlogManager initialPosts={posts} />
      </RecordFrame>
    </AgencyLayout>
  );
}
