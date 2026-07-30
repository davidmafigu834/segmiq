import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { upsertContactPrefs, getContactPrefs } from "@/lib/marketing/consent";
import type { ConsentStatus } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; contactId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const prefs = await getContactPrefs(params.contactId);
  return NextResponse.json({
    prefs: prefs ?? {
      contact_id: params.contactId,
      client_id: params.clientId,
      whatsapp_marketing: "unknown",
      service_updates: "opted_in",
      suppressed: false,
    },
  });
}

const updateSchema = z.object({
  whatsapp_marketing: z.enum(["opted_in", "opted_out", "unknown"]).optional(),
  service_updates: z.enum(["opted_in", "opted_out", "unknown"]).optional(),
  consent_source: z.string().nullable().optional(),
  consent_wording_version: z.string().nullable().optional(),
  suppressed: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; contactId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (g.session.role !== "CLIENT_MANAGER" && g.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const patch: Parameters<typeof upsertContactPrefs>[2] = {};
  if (parsed.data.whatsapp_marketing) {
    patch.whatsapp_marketing = parsed.data.whatsapp_marketing as ConsentStatus;
    if (parsed.data.whatsapp_marketing === "opted_in") {
      patch.consent_date = new Date().toISOString();
      patch.consent_source = parsed.data.consent_source ?? "manual";
      patch.opt_out_at = null;
      patch.opt_out_reason = null;
    }
    if (parsed.data.whatsapp_marketing === "opted_out") {
      patch.opt_out_at = new Date().toISOString();
      patch.opt_out_reason = "Manual opt-out";
    }
  }
  if (parsed.data.service_updates) {
    patch.service_updates = parsed.data.service_updates as ConsentStatus;
  }
  if (parsed.data.consent_wording_version !== undefined) {
    patch.consent_wording_version = parsed.data.consent_wording_version;
  }
  if (parsed.data.suppressed !== undefined) {
    patch.suppressed = parsed.data.suppressed;
  }

  const prefs = await upsertContactPrefs(params.contactId, params.clientId, patch);
  if (!prefs) {
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }

  return NextResponse.json({ prefs });
}
