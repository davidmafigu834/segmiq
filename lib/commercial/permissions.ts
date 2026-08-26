import type { UserRole } from "@/types";
import { resolveMarginVisibility } from "@/lib/quotations/governance";
import type { QuotationSettingsRow } from "@/types";

export const COMMERCIAL_PERMISSIONS = [
  "products.view",
  "products.create",
  "products.edit",
  "products.archive",
  "products.categories.manage",
  "products.import",
  "products.export",
  "pricing.viewSelling",
  "pricing.editSelling",
  "cost.view",
  "cost.edit",
  "inventory.view",
  "inventory.adjust",
  "inventory.transfer",
  "inventory.viewMovements",
  "inventory.manageLocations",
  "inventory.import",
  "inventory.export",
  "packages.view",
  "packages.create",
  "packages.edit",
  "packages.archive",
] as const;

export type CommercialPermission = (typeof COMMERCIAL_PERMISSIONS)[number];

export type CommercialActor = {
  userId: string;
  role: UserRole | string;
  clientId: string | null;
};

function isManager(role: string): boolean {
  return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
}

/**
 * Role-mapped commercial permissions. Cost is never implied by products.view.
 */
export function hasCommercialPermission(
  actor: CommercialActor,
  permission: CommercialPermission,
  opts?: { quotationSettings?: Partial<QuotationSettingsRow> | null }
): boolean {
  const role = actor.role ?? "";
  if (role === "SUPER_ADMIN" || role === "CLIENT_MANAGER") {
    if (permission === "cost.view" || permission === "cost.edit") {
      if (role === "SUPER_ADMIN") return true;
      return resolveMarginVisibility(opts?.quotationSettings ?? {}, true) === "full";
    }
    return true;
  }
  if (role !== "SALESPERSON") return false;

  switch (permission) {
    case "products.view":
    case "packages.view":
    case "pricing.viewSelling":
    case "inventory.view":
      return true;
    case "cost.view":
      return resolveMarginVisibility(opts?.quotationSettings ?? {}, false) === "full";
    default:
      return false;
  }
}

export function assertCommercialPermission(
  actor: CommercialActor,
  permission: CommercialPermission,
  opts?: { quotationSettings?: Partial<QuotationSettingsRow> | null }
): { ok: true } | { ok: false; status: 403; error: string } {
  if (hasCommercialPermission(actor, permission, opts)) return { ok: true };
  return { ok: false, status: 403, error: "Forbidden" };
}

export function canSeeCost(
  actor: CommercialActor,
  quotationSettings?: Partial<QuotationSettingsRow> | null
): boolean {
  return hasCommercialPermission(actor, "cost.view", { quotationSettings });
}

export function isCommercialManager(role: string | null | undefined): boolean {
  return isManager(role ?? "");
}
