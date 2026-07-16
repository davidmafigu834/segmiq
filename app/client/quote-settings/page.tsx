import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { QuoteSettingsManager } from "@/components/client-settings/QuoteSettingsManager";
import { PageHeader } from "@/components/ui";

export default async function ClientQuoteSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", session.clientId)
    .single();

  if (!client) redirect("/login");

  const clientName = client.name as string;

  return (
    <ClientManagerLayout breadcrumbPage="QUOTATIONS" pageTitle="Quotation settings" hideShellHeader>
      <div className="min-w-0 w-full max-w-full pb-16">
        <PageHeader
          className="mb-8"
          eyebrow={`${clientName} / Quotations`}
          title="Quotation settings"
          description="Manage your product catalog and the company details that appear on every quote PDF."
        />

        <QuoteSettingsManager clientId={session.clientId} />
      </div>
    </ClientManagerLayout>
  );
}
