import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { SubmissionsManager } from "@/components/agency/SubmissionsManager";
import { listSubmissions } from "@/lib/marketing-submissions";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "AGENCY_ADMIN") {
    redirect("/login");
  }

  let submissions: Awaited<ReturnType<typeof listSubmissions>> = [];
  try {
    submissions = await listSubmissions();
  } catch {
    submissions = [];
  }

  return (
    <AgencyLayout breadcrumb="AGENCY / SUBMISSIONS" pageTitle="Marketing submissions">
      <SubmissionsManager initialSubmissions={submissions} />
    </AgencyLayout>
  );
}
