export type ProductSectionId =
  | "overview"
  | "variants"
  | "pricing"
  | "inventory"
  | "quotation"
  | "specifications"
  | "documents"
  | "activity";

export type SpecRow = { id: string; group: string; name: string; value: string };
export type DocRow = {
  id: string;
  name: string;
  url: string;
  category: string;
  uploaded_at?: string | null;
  size?: string | null;
};

export type InventorySummary = {
  trackInventory: boolean;
  onHand: number | null;
  reserved: number | null;
  available: number | null;
  reorderLevel: number | null;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_TRACKED";
  locations: Array<{
    locationId: string;
    name: string;
    onHand: number;
    reserved: number;
    available: number;
    reorderLevel: number | null;
  }>;
};

export type ProductRecord = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  item_type: "PRODUCT" | "SERVICE";
  category_id: string | null;
  category?: { id: string; name: string } | null;
  status: string;
  unit: string;
  selling_price: number;
  currency: string;
  tax_rate: number | null;
  cost_price?: number | null;
  description: string | null;
  quotation_description: string | null;
  warranty: string | null;
  track_inventory: boolean;
  allow_fractional_qty: boolean;
  can_be_quoted: boolean;
  requires_technical_confirmation: boolean;
  price_editable_on_quote: boolean;
  discount_allowed: boolean;
  primary_image_url: string | null;
  specs: SpecRow[] | unknown;
  documents: DocRow[] | unknown;
  variants?: Array<Record<string, unknown>>;
  attributeDefs?: Array<Record<string, unknown>>;
  packageCount?: number;
  usedInPackages?: Array<{ id: string; name: string; status: string }>;
  inventory?: InventorySummary;
};

export type ProductFormState = {
  name: string;
  item_type: "PRODUCT" | "SERVICE";
  category_id: string;
  sku: string;
  brand: string;
  barcode: string;
  unit: string;
  description: string;
  status: string;
  track_inventory: boolean;
  selling_price: string;
  currency: string;
  tax_rate: string;
  cost_price: string;
  quotation_description: string;
  warranty: string;
  can_be_quoted: boolean;
  requires_technical_confirmation: boolean;
  price_editable_on_quote: boolean;
  discount_allowed: boolean;
  allow_fractional_qty: boolean;
  primary_image_url: string;
  specs: SpecRow[];
  documents: DocRow[];
};

export type CategoryOption = { id: string; name: string; status: string };
export type UnitOption = { code: string; name: string };

export function emptyProductForm(): ProductFormState {
  return {
    name: "",
    item_type: "PRODUCT",
    category_id: "",
    sku: "",
    brand: "",
    barcode: "",
    unit: "Each",
    description: "",
    status: "ACTIVE",
    track_inventory: false,
    selling_price: "",
    currency: "USD",
    tax_rate: "",
    cost_price: "",
    quotation_description: "",
    warranty: "",
    can_be_quoted: true,
    requires_technical_confirmation: false,
    price_editable_on_quote: true,
    discount_allowed: true,
    allow_fractional_qty: false,
    primary_image_url: "",
    specs: [],
    documents: [],
  };
}

export function formFromProduct(p: ProductRecord): ProductFormState {
  return {
    name: String(p.name ?? ""),
    item_type: p.item_type === "SERVICE" ? "SERVICE" : "PRODUCT",
    category_id: p.category_id ?? "",
    sku: String(p.sku ?? ""),
    brand: String(p.brand ?? ""),
    barcode: String(p.barcode ?? ""),
    unit: String(p.unit ?? "Each"),
    description: String(p.description ?? ""),
    status: String(p.status ?? "ACTIVE"),
    track_inventory: Boolean(p.track_inventory),
    selling_price: p.selling_price == null ? "" : String(p.selling_price),
    currency: String(p.currency ?? "USD"),
    tax_rate: p.tax_rate == null ? "" : String(p.tax_rate),
    cost_price: p.cost_price == null || p.cost_price === undefined ? "" : String(p.cost_price),
    quotation_description: String(p.quotation_description ?? ""),
    warranty: String(p.warranty ?? ""),
    can_be_quoted: p.can_be_quoted !== false,
    requires_technical_confirmation: Boolean(p.requires_technical_confirmation),
    price_editable_on_quote: p.price_editable_on_quote !== false,
    discount_allowed: p.discount_allowed !== false,
    allow_fractional_qty: Boolean(p.allow_fractional_qty),
    primary_image_url: String(p.primary_image_url ?? ""),
    specs: normalizeSpecs(p.specs),
    documents: normalizeDocs(p.documents),
  };
}

export function normalizeSpecs(raw: unknown): SpecRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row, i) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? `spec-${i}`),
      group: String(r.group ?? r.section ?? "General"),
      name: String(r.name ?? r.key ?? ""),
      value: String(r.value ?? ""),
    };
  });
}

export function normalizeDocs(raw: unknown): DocRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row, i) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? `doc-${i}`),
      name: String(r.name ?? r.file ?? "File"),
      url: String(r.url ?? ""),
      category: String(r.category ?? "Technical"),
      uploaded_at: (r.uploaded_at as string | null) ?? (r.updated_at as string | null) ?? null,
      size: (r.size as string | null) ?? null,
    };
  });
}

export function stockLabel(status?: string | null): string {
  if (status === "IN_STOCK") return "In stock";
  if (status === "LOW_STOCK") return "Low stock";
  if (status === "OUT_OF_STOCK") return "Out of stock";
  return "Not tracked";
}

export function statusLabel(status?: string | null): string {
  if (status === "ACTIVE") return "Active";
  if (status === "INACTIVE") return "Inactive";
  if (status === "ARCHIVED") return "Archived";
  return status || "—";
}

export function formatQty(n: number | null | undefined, unit: string): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toLocaleString()} ${unit}`.trim();
}

export function newRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
