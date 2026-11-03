import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { ComplianceCentre } from "@/components/real-estate/compliance/ComplianceCentre";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import { shouldRedirectFromRealEstateRoute } from "@/lib/real-estate/gating";

export const dynamic = "force-dynamic";

export default async function SalesCompliancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session) || !session.clientId) redirect("/login");
  const supabase = createAdminClient();
  const { data: client } = await supabase.from("clients").select("business_type").eq("id", session.clientId).maybeSingle();
  if (shouldRedirectFromRealEstateRoute(client?.business_type)) redirect("/sales/dashboard");
  const shell = await loadSalesShellProps(session);
  const manager = session.role === "CLIENT_MANAGER";
  return (
    <SalesLayout breadcrumb="Sales / COMPLIANCE" pageTitle="Compliance" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell {...shell} breadcrumb="Sales / Compliance" title="Compliance" description="What is needed, what was submitted, and what happens next." searchPlaceholder="Search compliance...">
        <ComplianceCentre clientId={session.clientId} manager={manager} />
      </SalesAppShell>
    </SalesLayout>
  );
}
