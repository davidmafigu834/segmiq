import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { BlogPostForm } from "@/components/agency/BlogPostForm";
import { RecordFrame } from "@/components/platform/workbench";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <AgencyLayout breadcrumb="PLATFORM / BLOG / NEW" pageTitle="New post">
      <RecordFrame
        detail="Write the draft here. Publishing is a later decision."
        fact={{
          name: "This post is not on the register yet.",
          detail: "Save the draft, then return to the list.",
          action: "Back to blog",
          href: "/dashboard/blog",
        }}
      >
        <BlogPostForm />
      </RecordFrame>
    </AgencyLayout>
  );
}
