import { createAdminClient } from "@/lib/supabase/admin";

export type WhatsAppSendConfig = {
  phoneNumberId: string;
  accessToken: string;
  displayNumber: string | null;
};

/**
 * Resolve Meta Cloud API credentials for a client.
 * Each company connects their own WhatsApp number (Phone number ID on `clients`).
 * Access token is read from the client row when set, otherwise the platform env token.
 */
export async function resolveWhatsAppSendConfig(
  clientId: string | null | undefined
): Promise<WhatsAppSendConfig | null> {
  const accessToken =
    process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.FB_ACCESS_TOKEN?.trim() ||
    "";

  if (!clientId) {
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
    if (!phoneNumberId || !accessToken) return null;
    return { phoneNumberId, accessToken, displayNumber: null };
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

  const token =
    (client?.meta_whatsapp_access_token as string | null)?.trim() || accessToken;

  if (!phoneNumberId || !token) return null;

  return {
    phoneNumberId,
    accessToken: token,
    displayNumber: (client?.meta_whatsapp_display_number as string | null)?.trim() || null,
  };
}
