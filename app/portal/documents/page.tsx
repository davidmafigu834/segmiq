import { PortalFrame } from "@/components/portal/PortalFrame";
import { requirePortal } from "@/lib/portal/page";
import { listPortalDocuments } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalDocumentsPage() {
  const identity = await requirePortal();
  const documents = await listPortalDocuments(identity.clientId, identity.contactId);
  return (
    <PortalFrame companyName={identity.companyName} logoUrl={identity.logoUrl} active="documents">
      <h1 className="text-[2rem] font-semibold leading-tight">Documents</h1>
      {documents.length ? (
        <ul className="mt-6 divide-y divide-sales-border">
          {documents.map((document) => (
            <li key={document.id as string}>
              <a href={`/api/portal/documents/${document.id}`} className="block py-4">
                <p className="text-[16px] font-semibold">{document.title}</p>
                <p className="mt-1 text-[14px] text-sales-text-secondary">{document.category}</p>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-[16px] text-sales-text-secondary">Documents shared with you will appear here.</p>
      )}
    </PortalFrame>
  );
}
