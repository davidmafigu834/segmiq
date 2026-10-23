import {
  requireCatalogueRow,
  type Catalogue,
} from "@/lib/commercial/catalogue";
import type {
  DiscountInput,
  QuoteInput,
  QuoteLineSnapshot,
  QuoteSnapshot,
} from "@/lib/platform-sales/types";

export function calculatePlatformQuote(
  catalogue: Catalogue,
  input: QuoteInput,
  approvedBy: string,
): QuoteSnapshot {
  if (!Number.isSafeInteger(input.seats) || input.seats < 1)
    throw new Error("Seats must be a positive whole number");
  if (input.aiSku && input.crmSku !== "crm_growth")
    throw new Error("Agentic AI requires Growth");
  if (
    !Number.isInteger(input.taxRateBasisPoints) ||
    input.taxRateBasisPoints < 0 ||
    input.taxRateBasisPoints > 10000
  )
    throw new Error("Invalid tax rate");
  const crm = requireCatalogueRow(catalogue, input.crmSku);
  const lines: QuoteLineSnapshot[] = [line(crm, input.seats, "recurring")];
  if (input.aiSku)
    lines.push(
      line(requireCatalogueRow(catalogue, input.aiSku), 1, "recurring"),
    );
  for (const sku of [...new Set(input.serviceSkus)])
    lines.push(line(requireCatalogueRow(catalogue, sku), 1, "one_time"));
  const recurringSubtotalUsdCents = sum(
    lines
      .filter((item) => item.scope === "recurring")
      .map((item) => item.subtotalUsdCents),
  );
  const oneTimeSubtotalUsdCents = sum(
    lines
      .filter((item) => item.scope === "one_time")
      .map((item) => item.subtotalUsdCents),
  );
  const discountAmount = input.discount
    ? calculateDiscount(
        input.discount,
        input.discount.scope === "recurring"
          ? recurringSubtotalUsdCents
          : oneTimeSubtotalUsdCents,
      )
    : 0;
  const recurringDiscountUsdCents =
    input.discount?.scope === "recurring" ? discountAmount : 0;
  const oneTimeDiscountUsdCents =
    input.discount?.scope === "one_time" ? discountAmount : 0;
  const recurringTotalUsdCents =
    recurringSubtotalUsdCents - recurringDiscountUsdCents;
  const oneTimeTotalUsdCents =
    oneTimeSubtotalUsdCents - oneTimeDiscountUsdCents;
  const taxable = recurringTotalUsdCents + oneTimeTotalUsdCents;
  const taxUsdCents = Math.round((taxable * input.taxRateBasisPoints) / 10000);
  const ai = input.aiSku ? requireCatalogueRow(catalogue, input.aiSku) : null;
  return {
    catalogueVersion: "2026-10-22",
    currency: "USD",
    pricingSource: "platform_price_catalog",
    lines,
    discount: input.discount
      ? { ...input.discount, amountUsdCents: discountAmount, approvedBy }
      : null,
    recurringSubtotalUsdCents,
    recurringDiscountUsdCents,
    recurringTotalUsdCents,
    oneTimeSubtotalUsdCents,
    oneTimeDiscountUsdCents,
    oneTimeTotalUsdCents,
    taxRateBasisPoints: input.taxRateBasisPoints,
    taxUsdCents,
    initialDueUsdCents: taxable + taxUsdCents,
    allowances: {
      conversations: ai?.includedConversations ?? null,
      internalAiActions: ai?.includedAiActions ?? null,
      agentConfigurations: ai?.maxAgentConfigurations ?? null,
      metered: false,
    },
  };
}

function line(
  row: ReturnType<typeof requireCatalogueRow>,
  quantity: number,
  scope: "recurring" | "one_time",
): QuoteLineSnapshot {
  const subtotalUsdCents = row.priceUsdCents * quantity;
  if (!Number.isSafeInteger(subtotalUsdCents))
    throw new Error("Quote total exceeds the safe integer range");
  return {
    sku: row.sku,
    name: row.name,
    unit: row.billingUnit,
    unitPriceUsdCents: row.priceUsdCents,
    quantity,
    subtotalUsdCents,
    scope,
  };
}
function calculateDiscount(discount: DiscountInput, subtotal: number): number {
  if (discount.reason.trim().length < 3)
    throw new Error("Discount reason is required");
  if (!Number.isSafeInteger(discount.value) || discount.value < 0)
    throw new Error("Discount must use non-negative integer units");
  const amount =
    discount.kind === "fixed"
      ? discount.value
      : Math.round((subtotal * discount.value) / 10000);
  if (discount.kind === "percent" && discount.value > 10000)
    throw new Error("Discount cannot exceed 100%");
  if (amount > subtotal)
    throw new Error("Discount cannot create a negative total");
  return amount;
}
function sum(values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total))
    throw new Error("Quote total exceeds the safe integer range");
  return total;
}
