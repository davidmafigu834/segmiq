import { resolveWhatsAppSendConfig } from "@/lib/whatsapp/credentials";

const META_GRAPH_VERSION = "v21.0";

export function graphUrl(path: string): string {
  return `https://graph.facebook.com/${META_GRAPH_VERSION}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function resolveClientWabaId(clientId: string): Promise<{
  wabaId: string;
  accessToken: string;
  phoneNumberId: string;
} | null> {
  const waConfig = await resolveWhatsAppSendConfig(clientId);
  if (!waConfig) return null;

  try {
    const url =
      graphUrl(`/${waConfig.phoneNumberId}`) +
      `?fields=whatsapp_business_account&access_token=${encodeURIComponent(waConfig.accessToken)}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      whatsapp_business_account?: { id?: string };
    };

    const wabaId =
      data.whatsapp_business_account?.id?.trim() ??
      process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() ??
      null;

    if (!wabaId) return null;

    return {
      wabaId,
      accessToken: waConfig.accessToken,
      phoneNumberId: waConfig.phoneNumberId,
    };
  } catch {
    return null;
  }
}

export function slugifyTemplateName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}
