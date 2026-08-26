import { commercialContext, jsonOk } from "@/lib/commercial/api";
import { searchCommercialItems } from "@/lib/products/search";
import type { CommercialSearchType } from "@/lib/commercial/types";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.view");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const types: CommercialSearchType[] | "ALL" =
    type === "PRODUCT" || type === "SERVICE" || type === "PACKAGE" ? [type] : "ALL";
  const result = await searchCommercialItems({
    clientId: params.clientId,
    q: url.searchParams.get("q") ?? undefined,
    types,
    limit: Number(url.searchParams.get("limit") || 12),
    canSeeCost: ctx.canSeeCost,
  });
  return jsonOk(result);
}
