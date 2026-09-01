import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CompanyDocumentsAttentionPage } from "@/components/dashboard/company/documents/CompanyDocumentsAttentionPage";
import { isCommercialFlagEnabled } from "@/lib/commercial/flags";
import { getDocumentsHomeSummary } from "@/lib/documents/list-service";
import { toDocumentActor } from "@/lib/documents/service";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsAttentionRoute({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="DOCUMENTS" pageTitle="Attention">
      {(chrome) => <AttentionContent chrome={chrome} />}
    </CommercialRoute>
  );
}

async function AttentionContent({
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

  const summary = await getDocumentsHomeSummary(
    chrome.clientId,
    toDocumentActor({
      userId: session.userId,
      role: session.role,
      clientId: session.clientId,
    })
  );

  return <CompanyDocumentsAttentionPage clientId={chrome.clientId} chrome={chrome} summary={summary} />;
}
