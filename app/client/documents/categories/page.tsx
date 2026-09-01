import { redirect } from "next/navigation";
import { CompanyDocumentCategoriesPage } from "@/components/dashboard/company/documents/CompanyDocumentCategoriesPage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { loadCompanyCommercialChrome } from "@/lib/commercial/page-chrome";
import { isCommercialFlagEnabled } from "@/lib/commercial/flags";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsCategoriesPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const chrome = await loadCompanyCommercialChrome(searchParams);
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const supabase = createAdminClient();
  const { data: clientRow } = await supabase
    .from("clients")
    .select("commercial_flags")
    .eq("id", chrome.clientId)
    .maybeSingle();

  const flagEnabled = isCommercialFlagEnabled(clientRow?.commercial_flags, "documents.enabled");
  const settings = await loadDocumentCompanySettings(chrome.clientId);
  if (!flagEnabled || !settings.enabled) redirect("/client/documents");

  return (
    <ClientManagerLayout
      breadcrumbPage="DOCUMENTS"
      pageTitle="Categories"
      hideShellHeader
      hideShellSidebar
      navClientId={chrome.clientId}
    >
      <CompanyDocumentCategoriesPage clientId={chrome.clientId} />
    </ClientManagerLayout>
  );
}
