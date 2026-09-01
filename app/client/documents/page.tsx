import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyDocumentsPage } from "@/components/dashboard/company/documents/CompanyDocumentsPage";
import { loadCompanyCommercialChrome } from "@/lib/commercial/page-chrome";
import { isCommercialFlagEnabled } from "@/lib/commercial/flags";
import {
  getCompanyDocumentsPageData,
  toDocumentActor,
} from "@/lib/documents/get-documents-page-data";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentListFilters } from "@/lib/documents/list-service";

export const dynamic = "force-dynamic";

function parseFilters(searchParams: Record<string, string | string[] | undefined>): DocumentListFilters {
  const get = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : undefined;
  };
  return {
    q: get("q"),
    collection: get("collection"),
    lifecycleStatus: get("lifecycleStatus"),
    processingStatus: get("processingStatus"),
    documentTypeId: get("documentTypeId"),
  };
}

export default async function ClientDocumentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const chrome = await loadCompanyCommercialChrome({
    clientId: typeof searchParams.clientId === "string" ? searchParams.clientId : undefined,
  });
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

  const actor = toDocumentActor({
    userId: session.userId,
    role: session.role,
    clientId: session.clientId,
  });

  const filters = parseFilters(searchParams);
  const data = enabled
    ? await getCompanyDocumentsPageData({
        clientId: chrome.clientId,
        actor,
        filters,
        limit: 25,
      })
    : {
        summary: {
          collections: [],
          attention: { needsReview: 0, failed: 0, processing: 0, total: 0 },
        },
        documents: [],
        total: 0,
        types: [],
      };

  return (
    <ClientManagerLayout
      breadcrumbPage="DOCUMENTS"
      pageTitle="Documents"
      hideShellHeader
      hideShellSidebar
      navClientId={chrome.clientId}
    >
      <Suspense fallback={null}>
        <CompanyDocumentsPage
          clientId={chrome.clientId}
          initialDocuments={data.documents}
          initialTotal={data.total}
          summary={data.summary}
          types={data.types}
          enabled={enabled}
        />
      </Suspense>
    </ClientManagerLayout>
  );
}
