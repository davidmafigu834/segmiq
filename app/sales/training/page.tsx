import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { TrainingPageClient } from "@/components/sales/training/TrainingPageClient";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";

export default async function SalesTrainingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.userId) redirect("/login");
  if (!canActAsSalesperson(session)) redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);

  return (
    <Layout
      breadcrumb="SALES / TRAINING"
      pageTitle="Training"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Help & Support / Training"
        title="SegmiQ Academy"
        description="Interactive training that teaches SegmiQ by using SegmiQ."
        showQuickActions={false}
        searchPlaceholder="Search leads, customers, quotes..."
      >
        <TrainingPageClient />
      </SalesAppShell>
    </Layout>
  );
}
