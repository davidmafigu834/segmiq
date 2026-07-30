import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { BlogPostForm } from "@/components/agency/BlogPostForm";
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
      <BlogPostForm post={post} />
    </AgencyLayout>
  );
}
