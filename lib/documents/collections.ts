export const DOCUMENT_COLLECTIONS = [
  { id: "contracts", label: "Contracts", typeCodes: ["CONTRACT"] },
  { id: "proposals", label: "Proposals", typeCodes: ["PROPOSAL"] },
  { id: "client_documents", label: "Client Documents", typeCodes: ["CUSTOMER_DOCUMENT", "CONTRACT", "PROPOSAL"] },
  { id: "supplier_documents", label: "Supplier Documents", typeCodes: ["SUPPLIER_DOCUMENT", "PURCHASE_ORDER"] },
  { id: "compliance", label: "Compliance", typeCodes: ["CERTIFICATE", "LICENCE", "INSURANCE"] },
  { id: "policies", label: "Policies", typeCodes: ["COMPANY_POLICY"] },
  { id: "drafts", label: "Drafts", lifecycleStatuses: ["DRAFT"] as const },
  { id: "signed", label: "Signed", lifecycleStatuses: ["SIGNED", "ACTIVE"] as const },
  { id: "needs_attention", label: "Needs Attention", attention: true as const },
  { id: "recent", label: "Recently Added", recentDays: 14 },
] as const;

export type DocumentCollectionId = (typeof DOCUMENT_COLLECTIONS)[number]["id"];

export function getCollectionDefinition(id: string) {
  return DOCUMENT_COLLECTIONS.find((c) => c.id === id) ?? null;
}
