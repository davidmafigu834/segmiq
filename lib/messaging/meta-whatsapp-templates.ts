/**
 * Meta WhatsApp template listing + arbitrary test sends (Agency Admin tester only).
 * Does not replace sendWhatsAppViaMeta — production sends stay on TemplateKey wrappers.
 */

const META_GRAPH_VERSION = "v21.0";

export type MetaTemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  buttons?: { type: string; text?: string; url?: string }[];
  example?: Record<string, unknown>;
};

export type MetaMessageTemplate = {
  name: string;
  language: string;
  status: string;
  category: string;
  components: MetaTemplateComponent[];
};

export type MetaTemplateSendComponent = Record<string, unknown>;

type MetaCredentials = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
};

function readMetaCredentials(): MetaCredentials | { error: string } {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const wabaId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (!accessToken) return { error: "META_WHATSAPP_ACCESS_TOKEN is not set" };
  if (!phoneNumberId) return { error: "META_WHATSAPP_PHONE_NUMBER_ID is not set" };
  if (!wabaId) return { error: "META_WHATSAPP_BUSINESS_ACCOUNT_ID is not set (required to list templates)" };
  return { accessToken, phoneNumberId, wabaId };
}

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${META_GRAPH_VERSION}${path.startsWith("/") ? path : `/${path}`}`;
}

type GraphErrorBody = {
  error?: { message?: string; code?: number; type?: string };
};

export async function listTemplates(): Promise<
  { ok: true; templates: MetaMessageTemplate[] } | { ok: false; error: string }
> {
  const creds = readMetaCredentials();
  if ("error" in creds) return { ok: false, error: creds.error };

  const templates: MetaMessageTemplate[] = [];
  let url: string | null =
    graphUrl(`/${creds.wabaId}/message_templates`) +
    `?fields=name,language,status,category,components&limit=100&access_token=${encodeURIComponent(creds.accessToken)}`;

  try {
    while (url) {
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as GraphErrorBody & {
        data?: MetaMessageTemplate[];
        paging?: { next?: string };
      };

      if (!res.ok || data.error) {
        return {
          ok: false,
          error: data.error?.message ?? `Meta API error (HTTP ${res.status})`,
        };
      }

      for (const row of data.data ?? []) {
        templates.push({
          name: row.name,
          language: row.language,
          status: row.status,
          category: row.category,
          components: row.components ?? [],
        });
      }

      url = data.paging?.next ?? null;
    }

    templates.sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, templates };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: e.message ?? "Failed to fetch templates from Meta" };
  }
}

export async function sendTemplateTest(params: {
  to: string;
  name: string;
  language: string;
  components: MetaTemplateSendComponent[];
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const creds = readMetaCredentials();
  if ("error" in creds) return { ok: false, error: creds.error };

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to.replace(/^\+/, ""),
    type: "template",
    template: {
      name: params.name,
      language: { code: params.language },
      ...(params.components.length > 0 ? { components: params.components } : {}),
    },
  };

  try {
    const res = await fetch(graphUrl(`/${creds.phoneNumberId}/messages`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as GraphErrorBody & {
      messages?: { id?: string }[];
    };

    if (!res.ok || data.error) {
      return {
        ok: false,
        error: data.error?.message ?? `Meta API error (HTTP ${res.status})`,
      };
    }

    const messageId = data.messages?.[0]?.id;
    if (!messageId) {
      return { ok: false, error: "Meta accepted the request but returned no message ID" };
    }

    return { ok: true, messageId };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: e.message ?? "Network error calling Meta API" };
  }
}

/** Sample OG image for image-header test sends. */
export function defaultSampleOgImageUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "https://segmiq.com";
  return `${base}/opengraph-image`;
}
