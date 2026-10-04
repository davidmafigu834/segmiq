import { PortalFrame } from "@/components/portal/PortalFrame";
import { requirePortal } from "@/lib/portal/page";
import { listPortalDocuments } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalDocumentsPage() {
  const identity = await requirePortal();
  const documents = await listPortalDocuments(identity.clientId, identity.contactId);
  return (
    <PortalFrame companyName={identity.companyName} logoUrl={identity.logoUrl} active="documents">
      <h1 className="text-4xl font-semibold tracking-tight">Documents</h1>
      <div className="mt-8 space-y-3">
        {documents.length ? documents.map((document) => (
          <a key={document.id as string} href={`/api/portal/documents/${document.id}`} className="block rounded-3xl bg-white p-5">
            <p className="font-semibold">{document.title}</p>
            <p className="mt-1 text-sm text-[#5c665f]">{document.category}</p>
          </a>
        )) : <p className="text-sm text-[#5c665f]">Documents shared with you will appear here.</p>}
      </div>
    </PortalFrame>
  );
}
