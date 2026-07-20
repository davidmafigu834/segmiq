import { resolveWhatsAppSendConfig } from "@/lib/whatsapp/credentials";
import type { MetaMessageTemplate } from "@/lib/messaging/meta-whatsapp-templates";
import { graphUrl, resolveClientWabaId } from "./waba";

export async function listClientMarketingTemplates(
  clientId: string
): Promise<{ ok: true; templates: MetaMessageTemplate[] } | { ok: false; error: string }> {
  const waConfig = await resolveWhatsAppSendConfig(clientId);
  if (!waConfig) {
    return { ok: false, error: "WhatsApp not configured for this client" };
  }

  const waba = await resolveClientWabaId(clientId);
  if (!waba) {
    return { ok: false, error: "Could not resolve WhatsApp Business Account ID" };
  }

  const templates: MetaMessageTemplate[] = [];
  let url: string | null =
    graphUrl(`/${waba.wabaId}/message_templates`) +
    `?fields=name,language,status,category,components&limit=100&access_token=${encodeURIComponent(waba.accessToken)}`;

  try {
    while (url) {
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        data?: MetaMessageTemplate[];
        paging?: { next?: string };
        error?: { message?: string };
      };

      if (!res.ok || data.error) {
        return { ok: false, error: data.error?.message ?? `Meta API error (HTTP ${res.status})` };
      }

      for (const row of data.data ?? []) {
        if (row.status === "APPROVED") {
          templates.push({
            name: row.name,
            language: row.language,
            status: row.status,
            category: row.category,
            components: row.components ?? [],
          });
        }
      }

      url = data.paging?.next ?? null;
    }

    templates.sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, templates };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: e.message ?? "Failed to fetch templates" };
  }
}

export function extractTemplateBodyPreview(template: MetaMessageTemplate): string {
  const body = template.components.find((c) => c.type === "BODY");
  return body?.text ?? template.name;
}

export function countTemplateVariables(template: MetaMessageTemplate): number {
  const body = template.components.find((c) => c.type === "BODY");
  if (!body?.text) return 0;
  const matches = body.text.match(/\{\{\d+\}\}/g);
  return matches?.length ?? 0;
}
