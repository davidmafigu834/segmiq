import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoles } from "@/lib/api-guards";
import { getAgencySettings } from "@/lib/agency-settings";
import { isWhatsAppDeliveryConfigured } from "@/lib/messaging/provider";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  agency_name: z.string().min(1).optional().nullable(),
  logo_url: z.string().max(2000).optional().nullable(),
  default_response_time_limit_hours: z.number().int().min(1).max(168).optional(),
  default_currency: z.string().min(1).max(8).optional(),
  default_timezone: z.string().min(1).max(64).optional(),
  terms_url: z.string().max(2000).optional().nullable(),
  privacy_url: z.string().max(2000).optional().nullable(),
});

export async function GET() {
  const g = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in g) return g.error;

  const settings = await getAgencySettings();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const metaToken = Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN?.trim());
  const twilioSid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM ?? "";
  const resendKey = Boolean(process.env.RESEND_API_KEY);
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  /** Resend sends fail without a verified-domain From; API key alone is not enough. */
  const resendReady = Boolean(resendKey && resendFrom);

  return NextResponse.json({
    settings,
    connections: {
      metaWhatsApp: {
        configured: Boolean(phoneNumberId && metaToken),
        provider: "Meta Cloud API" as const,
        phoneNumberIdMasked: phoneNumberId
          ? `${phoneNumberId.slice(0, 4)}…${phoneNumberId.slice(-4)}`
          : null,
        businessAccountIdMasked: (() => {
          const w = (process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim();
          if (!w) return null;
          if (w.length <= 8) return `${w.slice(0, 2)}…`;
          return `${w.slice(0, 4)}…${w.slice(-4)}`;
        })(),
      },
      twilio: {
        /** @deprecated — rollback only; primary transport is Meta Cloud API. */
        configured: Boolean(twilioSid && process.env.TWILIO_AUTH_TOKEN),
        accountSidMasked: twilioSid ? `${twilioSid.slice(0, 4)}…${twilioSid.slice(-4)}` : null,
        whatsappFrom: twilioFrom || null,
        legacy: isWhatsAppDeliveryConfigured() && !Boolean(phoneNumberId && metaToken),
      },
      resend: {
        configured: resendReady,
        fromEmail: resendFrom || null,
      },
    },
  });
}

export async function PATCH(req: Request) {
  const g = await requireRoles(["SUPER_ADMIN"]);
  if ("error" in g) return g.error;

  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.agency_name !== undefined) update.agency_name = body.agency_name;
  if (body.logo_url !== undefined) update.logo_url = body.logo_url || null;
  if (body.default_response_time_limit_hours !== undefined)
    update.default_response_time_limit_hours = body.default_response_time_limit_hours;
  if (body.default_currency !== undefined) update.default_currency = body.default_currency;
  if (body.default_timezone !== undefined) update.default_timezone = body.default_timezone;
  if (body.terms_url !== undefined) update.terms_url = body.terms_url || null;
  if (body.privacy_url !== undefined) update.privacy_url = body.privacy_url || null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("agency_settings").update(update).eq("id", "singleton").select("*").single();
  if (error) {
    console.error("[agency/settings PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
