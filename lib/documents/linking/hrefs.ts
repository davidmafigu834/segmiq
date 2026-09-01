import type { DocumentEntityType } from "@/lib/documents/linking/types";

export function buildEntityHref(
  entityType: DocumentEntityType,
  entityId: string,
  clientId: string
): string {
  const client = encodeURIComponent(clientId);
  switch (entityType) {
    case "CUSTOMER":
      return `/client/customers?customerId=${encodeURIComponent(entityId)}&clientId=${client}`;
    case "LEAD":
      return `/client/leads?lead=${encodeURIComponent(entityId)}&clientId=${client}`;
    case "DEAL":
      return `/client/deals/${encodeURIComponent(entityId)}?clientId=${client}`;
    case "QUOTATION":
      return `/client/quotations?quotation=${encodeURIComponent(entityId)}&clientId=${client}`;
    default:
      return `/client/documents?clientId=${client}`;
  }
}

export function entityTypeLabel(entityType: DocumentEntityType): string {
  switch (entityType) {
    case "CUSTOMER":
      return "Customer";
    case "LEAD":
      return "Lead";
    case "DEAL":
      return "Deal";
    case "QUOTATION":
      return "Quotation";
    default:
      return entityType.replace(/_/g, " ");
  }
}
