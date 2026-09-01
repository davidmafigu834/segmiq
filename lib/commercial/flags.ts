export const COMMERCIAL_FLAG_KEYS = [
  "products.v2.enabled",
  "inventory.enabled",
  "packages.v2.enabled",
  "quotation.productPickerV2",
  "inventory.externalSync",
  "documents.enabled",
] as const;

export type CommercialFlagKey = (typeof COMMERCIAL_FLAG_KEYS)[number];

export type CommercialFlags = Record<CommercialFlagKey, boolean>;

export const DEFAULT_COMMERCIAL_FLAGS: CommercialFlags = {
  "products.v2.enabled": true,
  "inventory.enabled": true,
  "packages.v2.enabled": true,
  "quotation.productPickerV2": true,
  "inventory.externalSync": false,
  "documents.enabled": false,
};

export function parseCommercialFlags(raw: unknown): CommercialFlags {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const next = { ...DEFAULT_COMMERCIAL_FLAGS };
  for (const key of COMMERCIAL_FLAG_KEYS) {
    if (typeof obj[key] === "boolean") next[key] = obj[key];
  }
  return next;
}

export function isCommercialFlagEnabled(raw: unknown, key: CommercialFlagKey): boolean {
  return parseCommercialFlags(raw)[key];
}
