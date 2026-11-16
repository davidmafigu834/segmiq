import { listDocuments } from "@/lib/documents/service";
import { Head, RegisterList } from "@/components/sales/solar/desk";
import { SolarSalesFrame } from "@/components/sales/solar/SolarSalesFrame";
import { loadSolarSalesPage } from "@/lib/sales/solar-workflow/salesperson-page";

export const dynamic = "force-dynamic";

export default async function SalesDocumentsPage() {
  const { session, shell, clientId } = await loadSolarSalesPage();
  const listed = await listDocuments({
    clientId,
    actor: { userId: session.userId, role: String(session.role ?? "SALESPERSON"), clientId },
    limit: 40,
  }).catch(() => ({ documents: [], total: 0 }));
  const rows = listed.documents.map((doc) => ({
    id: doc.id,
    name: doc.title || "Document",
    meta: doc.original_file_name || "File",
    fact: String(doc.lifecycle_status || "").replace(/_/g, " ").toLowerCase() || null,
  }));

  return (
    <SolarSalesFrame shell={shell} title="Documents" breadcrumb="Sales / Documents">
      <div className="space-y-8">
        <Head kicker="Management" title="Documents" detail="Files you are allowed to see for this company." />
        <RegisterList
          title="Files"
          rows={rows}
          emptyTitle="No documents yet"
          emptyDetail="Uploaded company files show here."
        />
      </div>
    </SolarSalesFrame>
  );
}
