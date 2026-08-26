import { commercialContext, jsonOk } from "@/lib/commercial/api";
import { bulkUpdateProducts } from "@/lib/products/service";
import type { ProductStatus } from "@/lib/commercial/types";

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.edit");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as { ids: string[]; status?: ProductStatus; category_id?: string | null };
  const result = await bulkUpdateProducts(params.clientId, body.ids ?? [], {
    status: body.status,
    category_id: body.category_id,
  });
  return jsonOk(result);
}
