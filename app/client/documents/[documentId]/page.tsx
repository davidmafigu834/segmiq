import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { DocumentDetailWorkspace } from "@/components/dashboard/company/documents/DocumentDetailWorkspace";
import { loadCompanyCommercialChrome } from "@/lib/commercial/page-chrome";
import { isCommercialFlagEnabled } from "@/lib/commercial/flags";
import { canCorrectDocumentIntelligence, canEditDocument } from "@/lib/documents/permissions";
import {
  getCompanyDocumentDetailData,
  toDocumentActor,
} from "@/lib/documents/get-document-detail-data";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientDocumentDetailPage({
  params,
  searchParams,
}: {
  params: { documentId: string };
  searchParams: { clientId?: string; tab?: string };
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

  const actor = toDocumentActor({
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
  });

  const result = await getCompanyDocumentDetailData({
    clientId: chrome.clientId,
    documentId: params.documentId,
    actor,
  });

  if (!result.ok) {
    if (result.status === 404) notFound();
    redirect("/client/documents");
  }

  const tab = searchParams.tab;
  const initialSection =
    tab === "versions" || tab === "activity" || tab === "document"
      ? tab
      : "overview";

  return (
    <ClientManagerLayout
      breadcrumbPage="DOCUMENTS"
      pageTitle={result.document.title}
      hideShellHeader
      hideShellSidebar
      navClientId={chrome.clientId}
      immersive
    >
      <DocumentDetailWorkspace
        clientId={chrome.clientId}
        document={result.document}
        version={result.version}
        typeLabel={result.typeLabel}
        versions={result.versions}
        activity={result.activity}
        policy={result.policy}
        content={result.content}
        tags={result.tags}
        classification={result.classification}
        categoryName={result.categoryName}
        intelligence={result.intelligence}
        links={result.links}
        canCorrectIntelligence={canCorrectDocumentIntelligence(actor)}
        canEditLinks={canEditDocument(actor)}
        initialSection={initialSection}
      />
    </ClientManagerLayout>
  );
}
