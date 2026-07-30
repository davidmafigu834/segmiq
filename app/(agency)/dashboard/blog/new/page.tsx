import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { BlogPostForm } from "@/components/agency/BlogPostForm";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <AgencyLayout breadcrumb="PLATFORM / BLOG / NEW" pageTitle="New post">
      <BlogPostForm />
    </AgencyLayout>
  );
}
