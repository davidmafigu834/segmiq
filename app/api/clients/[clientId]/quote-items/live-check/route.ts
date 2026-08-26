import { commercialContext, jsonOk } from "@/lib/commercial/api";
import { quoteInventoryAndPriceWarnings } from "@/lib/quotations/commercial-resolver";
import type { QuotationLineItemInput } from "@/types";

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.view");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as { items?: QuotationLineItemInput[] };
  const result = await quoteInventoryAndPriceWarnings(params.clientId, body.items ?? []);
  return jsonOk(result);
}
