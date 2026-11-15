import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { SubmissionsManager } from "@/components/agency/SubmissionsManager";
import { RecordFrame } from "@/components/platform/workbench";
import { listSubmissions } from "@/lib/marketing-submissions";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  let submissions: Awaited<ReturnType<typeof listSubmissions>> = [];
  try {
    submissions = await listSubmissions();
  } catch {
    submissions = [];
  }

  return (
    <AgencyLayout breadcrumb="PLATFORM / SUBMISSIONS" pageTitle="Marketing submissions">
      <RecordFrame
        detail="A submission is inbound. It is not an organisation until you create one."
        fact={{
          name: submissions.length ? `${submissions.length} submissions are on the register.` : "No submission is waiting.",
          detail: "Open the organisation only after the company exists.",
          action: "Open organisations",
          href: "/dashboard/clients",
        }}
      >
        <SubmissionsManager initialSubmissions={submissions} />
      </RecordFrame>
    </AgencyLayout>
  );
}
