import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { upsertAttributeDef, upsertVariant } from "@/lib/products/service";

export async function POST(req: Request, { params }: { params: { clientId: string; productId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.edit");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as Record<string, unknown>;
  if (body.kind === "attribute") {
    const result = await upsertAttributeDef(params.clientId, params.productId, {
      id: body.id as string | undefined,
      name: String(body.name ?? ""),
      options: Array.isArray(body.options) ? body.options.map(String) : [],
      sort_order: body.sort_order == null ? undefined : Number(body.sort_order),
    });
    if (result.error) return jsonErr(result.error, result.status ?? 400);
    return jsonOk(result, body.id ? 200 : 201);
  }
  const result = await upsertVariant(params.clientId, params.productId, body, body.id as string | undefined);
  if (result.error) return jsonErr(result.error, result.status ?? 400);
  return jsonOk(result, body.id ? 200 : 201);
}
