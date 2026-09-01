import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { loadCompanyCommercialChrome } from "@/lib/commercial/page-chrome";
import { isCommercialFlagEnabled } from "@/lib/commercial/flags";
import { getDocumentsHomeSummary } from "@/lib/documents/list-service";
import { toDocumentActor } from "@/lib/documents/service";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsAttentionPage({
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

  const summary = await getDocumentsHomeSummary(
    chrome.clientId,
    toDocumentActor({
      userId: session.userId,
      role: session.role,
      clientId: session.clientId,
    })
  );

  return (
    <ClientManagerLayout
      breadcrumbPage="DOCUMENTS"
      pageTitle="Needs attention"
      hideShellHeader
      hideShellSidebar
      navClientId={chrome.clientId}
    >
      <div className="px-4 py-6 md:px-6">
        <Link href="/client/documents" className="text-sm text-zinc-500 hover:text-lime-300">
          ← Documents
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-white">Needs attention</h1>
        <ul className="mt-6 space-y-3">
          <li className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
            <span className="text-sm text-zinc-300">Documents needing review</span>
            <Link
              href="/client/documents?processingStatus=NEEDS_REVIEW"
              className="text-sm font-medium text-lime-400 hover:underline"
            >
              {summary.attention.needsReview}
            </Link>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
            <span className="text-sm text-zinc-300">Failed analysis</span>
            <Link
              href="/client/documents?processingStatus=FAILED"
              className="text-sm font-medium text-lime-400 hover:underline"
            >
              {summary.attention.failed}
            </Link>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
            <span className="text-sm text-zinc-300">Currently processing</span>
            <span className="text-sm text-zinc-400">{summary.attention.processing}</span>
          </li>
        </ul>
      </div>
    </ClientManagerLayout>
  );
}
