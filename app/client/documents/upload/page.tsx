import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { DocumentsUploadZone } from "@/components/dashboard/company/documents/DocumentsUploadZone";
import { loadCompanyCommercialChrome } from "@/lib/commercial/page-chrome";
import { isCommercialFlagEnabled } from "@/lib/commercial/flags";
import { loadDocumentCompanySettings } from "@/lib/documents/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientDocumentsUploadPage({
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
      pageTitle="Upload"
      hideShellHeader
      hideShellSidebar
      navClientId={chrome.clientId}
    >
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
        <Link href="/client/documents" className="text-sm text-zinc-500 hover:text-lime-300">
          ← Documents
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-white">Upload documents</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Add one or more files. Analysis runs in the background after upload.
        </p>
        <div className="mt-6">
          <DocumentsUploadZone clientId={chrome.clientId} />
        </div>
      </div>
    </ClientManagerLayout>
  );
}
