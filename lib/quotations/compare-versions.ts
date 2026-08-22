import type { QuotationLineItemInput } from "@/types";
import { round2 } from "@/lib/quotations/totals";

export type VersionCompareInput = {
  revision: number;
  items: QuotationLineItemInput[];
  total: number;
  discountPercent: number;
  paymentTerms: string | null;
  validUntil: string | null;
  taxRate: number;
};

export type VersionDiffRow = {
  field: string;
  from: string;
  to: string;
};

function itemKey(it: QuotationLineItemInput): string {
  return [it.catalog_item_id ?? "", it.item_name.trim().toLowerCase(), it.sku ?? ""].join("|");
}

function lineLabel(it: QuotationLineItemInput): string {
  return it.item_name;
}

/**
 * Commercial-only comparison. Unchanged fields are omitted.
 */
export function compareQuotationVersions(
  a: VersionCompareInput,
  b: VersionCompareInput
): VersionDiffRow[] {
  const rows: VersionDiffRow[] = [];
  const aMap = new Map(a.items.map((it) => [itemKey(it), it]));
  const bMap = new Map(b.items.map((it) => [itemKey(it), it]));

  for (const [key, item] of bMap) {
    const prev = aMap.get(key);
    if (!prev) {
      rows.push({ field: `${lineLabel(item)} added`, from: "—", to: `${item.quantity} × ${item.unit_price}` });
      continue;
    }
    if (Number(prev.quantity) !== Number(item.quantity)) {
      rows.push({ field: `${lineLabel(item)} quantity`, from: String(prev.quantity), to: String(item.quantity) });
    }
    if (round2(Number(prev.unit_price)) !== round2(Number(item.unit_price))) {
      rows.push({
        field: `${lineLabel(item)} unit price`,
        from: String(prev.unit_price),
        to: String(item.unit_price),
      });
    }
    if (round2(Number(prev.discount_percent) || 0) !== round2(Number(item.discount_percent) || 0)) {
      rows.push({
        field: `${lineLabel(item)} discount`,
        from: `${Number(prev.discount_percent) || 0}%`,
        to: `${Number(item.discount_percent) || 0}%`,
      });
    }
    if (Boolean(prev.is_optional) !== Boolean(item.is_optional)) {
      rows.push({
        field: `${lineLabel(item)} optional`,
        from: prev.is_optional ? "Optional" : "Included",
        to: item.is_optional ? "Optional" : "Included",
      });
    }
  }
  for (const [key, item] of aMap) {
    if (!bMap.has(key)) {
      rows.push({ field: `${lineLabel(item)} removed`, from: `${item.quantity} × ${item.unit_price}`, to: "—" });
    }
  }

  if (round2(a.total) !== round2(b.total)) {
    rows.push({ field: "Total", from: String(a.total), to: String(b.total) });
  }
  if (round2(a.discountPercent) !== round2(b.discountPercent)) {
    rows.push({ field: "Document discount", from: `${a.discountPercent}%`, to: `${b.discountPercent}%` });
  }
  if ((a.paymentTerms ?? "").trim() !== (b.paymentTerms ?? "").trim()) {
    rows.push({ field: "Payment terms", from: a.paymentTerms || "—", to: b.paymentTerms || "—" });
  }
  if ((a.validUntil ?? "") !== (b.validUntil ?? "")) {
    rows.push({ field: "Validity", from: a.validUntil || "—", to: b.validUntil || "—" });
  }
  if (round2(a.taxRate) !== round2(b.taxRate)) {
    rows.push({ field: "Tax", from: `${a.taxRate}%`, to: `${b.taxRate}%` });
  }
  return rows;
}
