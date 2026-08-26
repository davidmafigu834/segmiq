import { commercialContext, jsonErr, jsonOk } from "@/lib/commercial/api";
import { createPackage, listPackages } from "@/lib/packages/service";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "packages.view");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  const result = await listPackages({
    clientId: params.clientId,
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    canSeeCost: ctx.canSeeCost,
  });
  if (result.error) return jsonErr(result.error, 500);
  return jsonOk(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const ctx = await commercialContext(req, params.clientId, "packages.create");
  if ("error" in ctx) return ctx.error;
  const body = (await req.json()) as Record<string, unknown>;
  const result = await createPackage(params.clientId, ctx.actor.userId, body);
  if (result.error) return jsonErr(result.error, result.status ?? 400);
  return jsonOk(result, 201);
}
