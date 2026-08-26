import { NextResponse } from "next/server";
import { requireClientAccessFromRequest, type GuardSession } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertCommercialPermission,
  canSeeCost,
  type CommercialActor,
  type CommercialPermission,
} from "@/lib/commercial/permissions";
import { parseCommercialFlags, type CommercialFlags } from "@/lib/commercial/flags";
import type { QuotationSettingsRow } from "@/types";

export type CommercialOk = {
  actor: CommercialActor;
  flags: CommercialFlags;
  canSeeCost: boolean;
  quotationSettings: Partial<QuotationSettingsRow> | null;
  session: GuardSession;
};

export async function commercialContext(
  req: Request,
  clientId: string,
  permission?: CommercialPermission
): Promise<{ error: NextResponse } | CommercialOk> {
  const g = await requireClientAccessFromRequest(req, clientId);
  if ("error" in g) {
    return { error: g.error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const actor: CommercialActor = {
    userId: g.session.userId,
    role: g.session.role,
    clientId: g.session.clientId,
  };
  const supabase = createAdminClient();
  const [{ data: client }, { data: settings }] = await Promise.all([
    supabase.from("clients").select("commercial_flags").eq("id", clientId).maybeSingle(),
    supabase
      .from("quotation_settings")
      .select("margin_visibility, salesperson_can_see_cost, salesperson_can_see_margin")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);
  const flags = parseCommercialFlags(client?.commercial_flags);
  if (permission) {
    const gate = assertCommercialPermission(actor, permission, {
      quotationSettings: (settings as Partial<QuotationSettingsRow> | null) ?? null,
    });
    if (!gate.ok) {
      return { error: NextResponse.json({ error: gate.error }, { status: gate.status }) };
    }
  }
  return {
    actor,
    flags,
    canSeeCost: canSeeCost(actor, settings),
    quotationSettings: (settings as Partial<QuotationSettingsRow> | null) ?? null,
    session: g.session,
  };
}

export function jsonOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function jsonErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
