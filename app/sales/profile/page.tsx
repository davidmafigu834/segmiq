import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { SalesProfileClient } from "@/components/sales/SalesProfileClient";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";

export default async function SalesProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.userId) redirect("/login");
  if (!canActAsSalesperson(session)) redirect("/login");

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;
  const shell = await loadSalesShellProps(session);

  return (
    <Layout
      breadcrumb="SALES / PROFILE"
      pageTitle="My profile"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Profile"
        title="My profile"
        description="Manage your personal details and sales preferences."
        showQuickActions={false}
        searchPlaceholder="Search leads, customers, quotes..."
      >
        <SalesProfileClient initialEmail={session.user.email} />
      </SalesAppShell>
    </Layout>
  );
}
