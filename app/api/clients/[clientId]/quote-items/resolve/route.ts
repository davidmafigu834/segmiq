import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { resolveQuoteItems } from "@/lib/quotations/commercial-resolver";
import type { QuoteSourceType } from "@/lib/commercial/types";

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.view");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as {
    sourceType: QuoteSourceType;
    productId?: string;
    variantId?: string;
    packageId?: string;
    quantity?: number;
    scale?: number;
    sectionId?: string;
    custom?: Record<string, unknown>;
  };
  const result = await resolveQuoteItems({
    clientId: params.clientId,
    sourceType: body.sourceType,
    productId: body.productId,
    variantId: body.variantId,
    packageId: body.packageId,
    quantity: body.quantity,
    scale: body.scale,
    sectionId: body.sectionId,
    custom: body.custom as never,
  });
  if (result.error) return jsonErr(result.error, 400);
  if (!ctx.canSeeCost) {
    result.lines = result.lines.map((l) => ({ ...l, cost_price: null }));
  }
  return jsonOk(result);
}
