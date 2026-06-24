import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { QuoteSettingsManager } from "@/components/client-settings/QuoteSettingsManager";

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

  return (
    <ClientManagerLayout breadcrumbPage="QUOTATIONS" pageTitle="Quotation settings">
      <div className="mx-auto max-w-4xl pb-16">
        <header className="mb-10">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[--text-tertiary]">
            {client.name as string} / Quotations
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-[--text-primary]">Quotation settings</h1>
          <p className="mt-2 text-sm text-[--text-secondary]">
            Manage your product catalog and the company details that appear on every quote PDF.
          </p>
        </header>

        <QuoteSettingsManager clientId={session.clientId} />
      </div>
    </ClientManagerLayout>
  );
}
