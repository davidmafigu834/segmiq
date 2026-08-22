import { createHash } from "crypto";
import type { QuotationLineItemInput } from "@/types";
import { round2 } from "@/lib/quotations/totals";

/** Server-only commercial fingerprint for approval invalidation. */
export function commercialFingerprint(input: {
  items: QuotationLineItemInput[];
  discountPercent: number;
  otherAmount: number;
  taxRate: number;
  paymentTermsLabel: string | null | undefined;
  validUntil: string | null | undefined;
  currency: string | null | undefined;
  total: number;
}): string {
  const lines = [...input.items]
    .map((it) =>
      [
        it.item_name?.trim() ?? "",
        Number(it.quantity) || 0,
        Number(it.unit_price) || 0,
        Number(it.discount_percent) || 0,
        Number(it.discount_amount) || 0,
        it.is_optional ? 1 : 0,
        it.catalog_item_id ?? "",
        it.offer_option_id ?? "",
        it.package_id ?? "",
      ].join(":")
    )
    .sort()
    .join("|");
  const payload = [
    lines,
    Number(input.discountPercent) || 0,
    Number(input.otherAmount) || 0,
    Number(input.taxRate) || 0,
    (input.paymentTermsLabel ?? "").trim(),
    input.validUntil ?? "",
    input.currency ?? "",
    round2(input.total),
  ].join("#");
  return createHash("sha256").update(payload).digest("hex");
}
