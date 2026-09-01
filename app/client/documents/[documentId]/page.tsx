import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CommercialRoute } from "@/components/dashboard/company/commercial/commercial-route";
import { CommercialModulePage } from "@/components/dashboard/company/commercial/CommercialModulePage";
import { DocumentDetailWorkspace } from "@/components/dashboard/company/documents/DocumentDetailWorkspace";
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
  searchParams: { clientId?: string; tab?: string; page?: string; highlight?: string };
}) {
  return (
    <CommercialRoute searchParams={searchParams} breadcrumbPage="DOCUMENTS" pageTitle="Document">
      {(chrome) => (
        <DocumentDetailPageContent
          chrome={chrome}
          documentId={params.documentId}
          tab={searchParams.tab}
          page={searchParams.page}
          highlight={searchParams.highlight}
        />
      )}
    </CommercialRoute>
  );
}

async function DocumentDetailPageContent({
  chrome,
  documentId,
  tab,
  page,
  highlight,
}: {
  chrome: Awaited<ReturnType<typeof import("@/lib/commercial/page-chrome").loadCompanyCommercialChrome>>;
  documentId: string;
  tab?: string;
  page?: string;
  highlight?: string;
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

  const actor = toDocumentActor({
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
  });

  const result = await getCompanyDocumentDetailData({
    clientId: chrome.clientId,
    documentId,
    actor,
  });

  if (!result.ok) {
    if (result.status === 404) notFound();
    redirect("/client/documents");
  }

  const initialSection =
    tab === "versions" || tab === "activity" || tab === "document" || tab === "obligations"
      ? tab
      : "overview";
  const initialPage = page ? Number(page) : undefined;
  const initialHighlight = highlight ? decodeURIComponent(highlight) : undefined;

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb={`COMPANY / DOCUMENTS / ${result.document.title.toUpperCase()}`}
      hideTitleBlock
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
        initialPage={initialPage && !Number.isNaN(initialPage) ? initialPage : undefined}
        initialHighlight={initialHighlight}
      />
    </CommercialModulePage>
  );
}
