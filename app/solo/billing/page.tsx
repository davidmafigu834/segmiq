import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { ClientBillingView } from "@/components/billing/ClientBillingView";
import { getClientBillingData } from "@/lib/billing/client-billing-data";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

export const dynamic = "force-dynamic";

export default async function SoloBillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "SALESPERSON" || session.clientMode !== "solo") redirect("/login");

  const [data, shell] = await Promise.all([
    getClientBillingData(session.clientId),
    loadSalesShellProps(session),
  ]);

  return (
    <SalesAppShell
      {...shell}
      userRoleLabel="Owner"
      breadcrumb="Solo / Billing"
      title="Billing"
      description="Subscription, invoices, and payment settings for your solo workspace."
    >
      <ClientBillingView
        subscription={data.subscription}
        invoices={data.invoices}
        outstanding={data.outstanding}
        currency={data.currency}
        settings={data.settings}
      />
    </SalesAppShell>
  );
}
