import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { DemoManagement } from "@/components/agency/demos/DemoManagement";
import { RecordFrame } from "@/components/platform/workbench";
import { loadDemoAdminDirectory } from "@/lib/demo/admin-directory";

export const dynamic = "force-dynamic";

export default async function DemonstrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");

  const directory = await loadDemoAdminDirectory();

  return (
    <AgencyLayout breadcrumb="Security / Demonstrations" pageTitle="Demonstrations">
      <RecordFrame
        detail="A demonstration is a separate record. It is not a customer organisation."
        fact={{
          name: "Open a demonstration only when you are showing the product.",
          detail: "Customer data stays on the organisation. This list does not grant support access.",
          action: "Open support access",
          href: "/dashboard/support-access",
        }}
      >
        <DemoManagement directory={directory} />
      </RecordFrame>
    </AgencyLayout>
  );
}
