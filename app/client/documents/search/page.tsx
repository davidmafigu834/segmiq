import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyDocumentsSearchPage } from "@/components/dashboard/company/documents/CompanyDocumentsSearchPage";
import { isCommercialFlagEnabled } from "@/lib/commercial/flags";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsSearchRoute({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="DOCUMENTS" pageTitle="Ask Documents">
      {(chrome) => <SearchPageContent chrome={chrome} />}
    </CommercialRoute>
  );
}

async function SearchPageContent({
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
  const enabled = flagEnabled && settings.enabled;

  return (
    <CompanyDocumentsSearchPage clientId={chrome.clientId} chrome={chrome} enabled={enabled} />
  );
}
