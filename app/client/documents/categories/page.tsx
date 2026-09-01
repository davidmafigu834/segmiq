import { redirect } from "next/navigation";
import { CompanyDocumentCategoriesPage } from "@/components/dashboard/company/documents/CompanyDocumentCategoriesPage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { isCommercialFlagEnabled } from "@/lib/commercial/flags";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsCategoriesRoute({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="DOCUMENTS" pageTitle="Categories">
      {(chrome) => <CategoriesContent chrome={chrome} />}
    </CommercialRoute>
  );
}

async function CategoriesContent({
  chrome,
}: {
  chrome: Awaited<ReturnType<typeof import("@/lib/commercial/page-chrome").loadCompanyCommercialChrome>>;
}) {
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

  return <CompanyDocumentCategoriesPage clientId={chrome.clientId} chrome={chrome} />;
}
