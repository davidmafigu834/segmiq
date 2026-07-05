import { createAdminClient } from "@/lib/supabase/admin";

export type WhatsAppSendConfig = {
  phoneNumberId: string;
  accessToken: string;
  displayNumber: string | null;
};

/** Meta Cloud API tokens are long strings, typically starting with `EAA`. */
export function isPlausibleMetaAccessToken(token: string | null | undefined): boolean {
  const t = token?.trim();
  if (!t) return false;
  return t.length >= 50 && /^EAA[A-Za-z0-9]+$/.test(t);
}

/**
 * Resolve Meta Cloud API credentials for a client.
 * Each company connects their own WhatsApp number (Phone number ID on `clients`).
 * Access token is read from the client row when set, otherwise the platform env token.
 */
export async function resolveWhatsAppSendConfig(
  clientId: string | null | undefined
): Promise<WhatsAppSendConfig | null> {
  const platformToken =
    process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.FB_ACCESS_TOKEN?.trim() ||
    "";

  if (!clientId) {
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
    if (!phoneNumberId || !platformToken) return null;
    return { phoneNumberId, accessToken: platformToken, displayNumber: null };
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("meta_whatsapp_phone_number_id, meta_whatsapp_display_number, meta_whatsapp_access_token")
    .eq("id", clientId)
    .maybeSingle();

  const phoneNumberId =
    (client?.meta_whatsapp_phone_number_id as string | null)?.trim() ||
    process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    "";

  const clientToken = (client?.meta_whatsapp_access_token as string | null)?.trim() || "";
  const accessToken = isPlausibleMetaAccessToken(clientToken) ? clientToken : platformToken;

  if (!phoneNumberId || !accessToken) return null;

  return {
    phoneNumberId,
    accessToken,
    displayNumber: (client?.meta_whatsapp_display_number as string | null)?.trim() || null,
  };
}
