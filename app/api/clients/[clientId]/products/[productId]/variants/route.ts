import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { upsertVariant } from "@/lib/products/service";

export async function POST(req: Request, { params }: { params: { clientId: string; productId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.edit");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as Record<string, unknown>;
  const result = await upsertVariant(params.clientId, params.productId, body, body.id as string | undefined);
  if (result.error) return jsonErr(result.error, result.status ?? 400);
  return jsonOk(result, body.id ? 200 : 201);
}
