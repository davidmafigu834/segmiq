import { createAdminClient } from "@/lib/supabase/admin";
import { revealMetaWhatsAppToken } from "@/lib/facebook/client-tokens";

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
 *
 * SECURITY (Phase 5):
 * - Prefer per-organisation sealed token + phone_number_id.
 * - Platform env token is NOT used as a silent fallback when the client has its own
 *   phone_number_id (prevents cross-tenant WABA blast radius).
 * - Platform fallback only when:
 *   - no clientId (legacy platform path), OR
 *   - client has neither phone nor token and META_WHATSAPP_ALLOW_PLATFORM_FALLBACK=true
 */
export async function resolveWhatsAppSendConfig(
  clientId: string | null | undefined
): Promise<WhatsAppSendConfig | null> {
  const platformToken =
    process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.FB_ACCESS_TOKEN?.trim() ||
    "";
  const platformPhone = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
  const allowPlatformFallback = process.env.META_WHATSAPP_ALLOW_PLATFORM_FALLBACK === "true";

  if (!clientId) {
    if (!platformPhone || !platformToken) return null;
    return { phoneNumberId: platformPhone, accessToken: platformToken, displayNumber: null };
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("meta_whatsapp_phone_number_id, meta_whatsapp_display_number, meta_whatsapp_access_token")
    .eq("id", clientId)
    .maybeSingle();

  const clientPhone = (client?.meta_whatsapp_phone_number_id as string | null)?.trim() || "";
  const revealed = await revealMetaWhatsAppToken(
    client?.meta_whatsapp_access_token as string | null,
    clientId
  );
  const clientToken = revealed?.trim() || "";

  if (clientPhone && isPlausibleMetaAccessToken(clientToken)) {
    return {
      phoneNumberId: clientPhone,
      accessToken: clientToken,
      displayNumber: (client?.meta_whatsapp_display_number as string | null)?.trim() || null,
    };
  }

  // Client configured a number but token missing/invalid — do not silently use platform token.
  if (clientPhone && !isPlausibleMetaAccessToken(clientToken)) {
    if (allowPlatformFallback && platformToken) {
      return {
        phoneNumberId: clientPhone,
        accessToken: platformToken,
        displayNumber: (client?.meta_whatsapp_display_number as string | null)?.trim() || null,
      };
    }
    return null;
  }

  // No client phone — optional explicit platform fallback for legacy tenants.
  if (allowPlatformFallback && platformPhone && platformToken) {
    return { phoneNumberId: platformPhone, accessToken: platformToken, displayNumber: null };
  }

  return null;
}
