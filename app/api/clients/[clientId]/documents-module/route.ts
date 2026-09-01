import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-guards";
import {
  getDocumentsModuleAccess,
  setDocumentsModuleEnabled,
} from "@/lib/documents/settings";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  enabled: z.boolean(),
});

/**
 * Enable or disable SegmiQ Documents for a company (commercial flag + company settings).
 * Super Admin only.
 */
export async function GET(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const guard = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in guard) return guard.error;

  try {
    const access = await getDocumentsModuleAccess(params.clientId);
    return NextResponse.json(access);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load documents module status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const guard = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in guard) return guard.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const access = await setDocumentsModuleEnabled(params.clientId, parsed.data.enabled);
    return NextResponse.json(access);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = message === "Client not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
