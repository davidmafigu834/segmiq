import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { createCategory, deactivateCategory, listCategories, updateCategory } from "@/lib/products/categories";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.view");
  if ("error" in ctx) return ctx.error;
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  const result = await listCategories(params.clientId, q);
  if (result.error) return jsonErr(result.error, 500);
  return jsonOk(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.categories.manage");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as { name: string; parent_id?: string | null; sort_order?: number };
  const result = await createCategory(params.clientId, body);
  if (result.error) return jsonErr(result.error, result.status ?? 400);
  return jsonOk(result, 201);
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "products.categories.manage");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as {
    id: string;
    name?: string;
    parent_id?: string | null;
    sort_order?: number;
    status?: "ACTIVE" | "INACTIVE";
    deactivate?: boolean;
  };
  if (!body.id) return jsonErr("id is required");
  const result = body.deactivate
    ? await deactivateCategory(params.clientId, body.id)
    : await updateCategory(params.clientId, body.id, body);
  if (result.error) return jsonErr(result.error, result.status ?? 400);
  return jsonOk(result);
}
