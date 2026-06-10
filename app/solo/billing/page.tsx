import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { ClientBillingView } from "@/components/billing/ClientBillingView";
import { getClientBillingData } from "@/lib/billing/client-billing-data";

export const dynamic = "force-dynamic";

export default async function SoloBillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "SALESPERSON" || session.clientMode !== "solo") redirect("/login");

  const data = await getClientBillingData(session.clientId);

  return (
    <SoloLayout breadcrumb="SOLO / BILLING" pageTitle="Billing">
      <ClientBillingView
        subscription={data.subscription}
        invoices={data.invoices}
        outstanding={data.outstanding}
        currency={data.currency}
        settings={data.settings}
      />
    </SoloLayout>
  );
}
