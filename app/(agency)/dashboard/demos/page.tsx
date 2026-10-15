import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { DemoManagement } from "@/components/agency/demos/DemoManagement";
import { loadDemoAdminDirectory } from "@/lib/demo/admin-directory";

export const dynamic = "force-dynamic";

export default async function DemonstrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");

  const directory = await loadDemoAdminDirectory();

  return (
    <AgencyLayout breadcrumb="Security / Demonstrations" pageTitle="Demonstrations">
      <DemoManagement directory={directory} />
    </AgencyLayout>
  );
}
