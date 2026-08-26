import type { PackageAvailabilityStatus } from "@/lib/commercial/types";

export type PackageComponentAvailability = {
  id: string;
  name: string;
  requiredQty: number;
  trackInventory: boolean;
  isService: boolean;
  optional: boolean;
  variantUnresolved: boolean;
  available: number | null;
  archived?: boolean;
  missingPrice?: boolean;
};

export type PackageAvailability = {
  status: PackageAvailabilityStatus;
  availableCount: number | null;
  limitedBy: string | null;
  reasons: string[];
};

export function packageAvailability(components: PackageComponentAvailability[]): PackageAvailability {
  const reasons: string[] = [];
  let minCount: number | null = null;
  let limitedBy: string | null = null;
  let tracked = false;

  for (const c of components) {
    if (c.archived) {
      reasons.push(`${c.name} is archived`);
      continue;
    }
    if (c.missingPrice) reasons.push(`${c.name} is missing a selling price`);
    if (c.isService || !c.trackInventory || c.optional) continue;
    if (c.variantUnresolved) {
      return {
        status: "SELECTION_REQUIRED",
        availableCount: null,
        limitedBy: c.name,
        reasons: ["Availability requires item selection"],
      };
    }
    tracked = true;
    const avail = Number(c.available ?? 0);
    const req = Number(c.requiredQty) || 0;
    if (req <= 0) continue;
    const count = Math.floor(avail / req);
    if (minCount == null || count < minCount) {
      minCount = count;
      limitedBy = c.name;
    }
  }

  if (reasons.some((r) => r.includes("archived"))) {
    return { status: "NEEDS_REVIEW", availableCount: minCount, limitedBy, reasons };
  }
  if (!tracked) {
    return { status: "NOT_TRACKED", availableCount: null, limitedBy: null, reasons };
  }
  if ((minCount ?? 0) <= 0) {
    return {
      status: "UNAVAILABLE",
      availableCount: 0,
      limitedBy,
      reasons: limitedBy ? [`Missing: ${limitedBy}`] : reasons,
    };
  }
  if ((minCount ?? 0) <= 4) {
    return { status: "LIMITED", availableCount: minCount, limitedBy, reasons };
  }
  return { status: "READY", availableCount: minCount, limitedBy, reasons };
}

export function scalePackageQuantities(baseQty: number, multiplier: number, allowFractional: boolean): number {
  const scale = Math.max(0.0001, Number(multiplier) || 1);
  const qty = (Number(baseQty) || 0) * scale;
  return allowFractional ? qty : Math.round(qty);
}
