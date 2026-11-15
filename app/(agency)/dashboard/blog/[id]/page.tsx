import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { BlogPostForm } from "@/components/agency/BlogPostForm";
import { RecordFrame } from "@/components/platform/workbench";
import { getBlogPostByIdAdmin } from "@/lib/blog-admin";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const post = await getBlogPostByIdAdmin(params.id);
  if (!post) notFound();

  return (
    <AgencyLayout breadcrumb="PLATFORM / BLOG / EDIT" pageTitle="Edit post">
      <RecordFrame
        detail={post.title || "Untitled draft"}
        fact={{
          name: post.status === "published" ? "This post is published." : "This post is still a draft.",
          detail: "The form below is the record.",
          action: "Back to blog",
          href: "/dashboard/blog",
        }}
      >
        <BlogPostForm post={post} />
      </RecordFrame>
    </AgencyLayout>
  );
}
