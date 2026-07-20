import { createAdminClient } from "@/lib/supabase/admin";
import { graphUrl, resolveClientWabaId, slugifyTemplateName } from "./waba";

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateMetaStatus = "draft" | "pending" | "approved" | "rejected" | "paused";

export type WhatsAppTemplateRow = {
  id: string;
  client_id: string;
  name: string;
  display_name: string | null;
  category: TemplateCategory;
  language: string;
  body: string;
  header: string | null;
  footer: string | null;
  buttons: { type: string; text: string }[];
  variable_examples: string[];
  meta_status: TemplateMetaStatus;
  rejection_reason: string | null;
  meta_template_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CreateTemplateInput = {
  displayName: string;
  category: TemplateCategory;
  language?: string;
  body: string;
  header?: string | null;
  footer?: string | null;
  buttons?: { type: string; text: string }[];
  variableExamples?: string[];
  createdBy?: string | null;
};

function buildMetaComponents(template: WhatsAppTemplateRow): Record<string, unknown>[] {
  const components: Record<string, unknown>[] = [];

  if (template.header?.trim()) {
    components.push({ type: "HEADER", format: "TEXT", text: template.header.trim() });
  }

  const bodyComponent: Record<string, unknown> = {
    type: "BODY",
    text: template.body,
  };

  if (template.variable_examples.length > 0) {
    bodyComponent.example = { body_text: [template.variable_examples] };
  }

  components.push(bodyComponent);

  if (template.footer?.trim()) {
    components.push({ type: "FOOTER", text: template.footer.trim() });
  }

  if (template.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: template.buttons.map((b) => ({
        type: b.type === "URL" ? "URL" : "QUICK_REPLY",
        text: b.text.slice(0, 25),
        ...(b.type === "URL" ? { url: "https://segmiq.com/{{1}}" } : {}),
      })),
    });
  }

  return components;
}

export async function listLocalTemplates(clientId: string): Promise<WhatsAppTemplateRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });

  return (data ?? []) as WhatsAppTemplateRow[];
}

export async function getLocalTemplate(
  clientId: string,
  templateId: string
): Promise<WhatsAppTemplateRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("client_id", clientId)
    .eq("id", templateId)
    .maybeSingle();

  return (data as WhatsAppTemplateRow | null) ?? null;
}

export async function createLocalTemplate(
  clientId: string,
  input: CreateTemplateInput
): Promise<WhatsAppTemplateRow> {
  const supabase = createAdminClient();
  const name = slugifyTemplateName(input.displayName);
  if (!name) throw new Error("Invalid template name");

  const varCount = (input.body.match(/\{\{\d+\}\}/g) ?? []).length;
  const examples = input.variableExamples ?? [];
  while (examples.length < varCount) {
    examples.push("Example");
  }

  const { data, error } = await supabase
    .from("whatsapp_templates")
    .insert({
      client_id: clientId,
      name,
      display_name: input.displayName.trim(),
      category: input.category,
      language: input.language ?? "en",
      body: input.body.trim(),
      header: input.header?.trim() || null,
      footer: input.footer?.trim() || null,
      buttons: input.buttons ?? [],
      variable_examples: examples.slice(0, varCount),
      meta_status: "draft",
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as WhatsAppTemplateRow;
}

export async function updateLocalTemplate(
  clientId: string,
  templateId: string,
  patch: Partial<CreateTemplateInput>
): Promise<WhatsAppTemplateRow> {
  const existing = await getLocalTemplate(clientId, templateId);
  if (!existing) throw new Error("Template not found");
  if (existing.meta_status === "approved") {
    throw new Error("Approved templates cannot be edited — create a new version instead");
  }

  const supabase = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.displayName) update.display_name = patch.displayName.trim();
  if (patch.category) update.category = patch.category;
  if (patch.language) update.language = patch.language;
  if (patch.body) update.body = patch.body.trim();
  if (patch.header !== undefined) update.header = patch.header?.trim() || null;
  if (patch.footer !== undefined) update.footer = patch.footer?.trim() || null;
  if (patch.buttons) update.buttons = patch.buttons;
  if (patch.variableExamples) update.variable_examples = patch.variableExamples;

  const { data, error } = await supabase
    .from("whatsapp_templates")
    .update(update)
    .eq("id", templateId)
    .eq("client_id", clientId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as WhatsAppTemplateRow;
}

export async function submitTemplateToMeta(
  clientId: string,
  templateId: string
): Promise<{ ok: true; template: WhatsAppTemplateRow } | { ok: false; error: string }> {
  const template = await getLocalTemplate(clientId, templateId);
  if (!template) return { ok: false, error: "Template not found" };

  const waba = await resolveClientWabaId(clientId);
  if (!waba) return { ok: false, error: "WhatsApp not configured for this client" };

  const payload = {
    name: template.name,
    language: template.language,
    category: template.category,
    components: buildMetaComponents(template),
  };

  try {
    const res = await fetch(graphUrl(`/${waba.wabaId}/message_templates`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${waba.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      error?: { message?: string };
    };

    if (!res.ok || data.error) {
      const supabase = createAdminClient();
      await supabase
        .from("whatsapp_templates")
        .update({
          meta_status: "rejected",
          rejection_reason: data.error?.message ?? `HTTP ${res.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", templateId);

      return { ok: false, error: data.error?.message ?? `Meta API error (HTTP ${res.status})` };
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data: updated } = await supabase
      .from("whatsapp_templates")
      .update({
        meta_status: "pending",
        meta_template_id: data.id ?? null,
        submitted_at: now,
        rejection_reason: null,
        updated_at: now,
      })
      .eq("id", templateId)
      .select("*")
      .single();

    return { ok: true, template: updated as WhatsAppTemplateRow };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: e.message ?? "Network error" };
  }
}

export async function syncTemplateStatuses(clientId: string): Promise<number> {
  const waba = await resolveClientWabaId(clientId);
  if (!waba) return 0;

  const local = await listLocalTemplates(clientId);
  const pending = local.filter((t) => t.meta_status === "pending");
  if (pending.length === 0) return 0;

  let url: string | null =
    graphUrl(`/${waba.wabaId}/message_templates`) +
    `?fields=name,language,status,rejected_reason&limit=100&access_token=${encodeURIComponent(waba.accessToken)}`;

  const metaMap = new Map<string, { status: string; reason?: string }>();

  while (url) {
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      data?: { name: string; language: string; status: string; rejected_reason?: string }[];
      paging?: { next?: string };
    };

    for (const row of data.data ?? []) {
      metaMap.set(`${row.name}:${row.language}`, {
        status: row.status,
        reason: row.rejected_reason,
      });
    }
    url = data.paging?.next ?? null;
  }

  const supabase = createAdminClient();
  let synced = 0;
  const now = new Date().toISOString();

  for (const tpl of pending) {
    const key = `${tpl.name}:${tpl.language}`;
    const meta = metaMap.get(key);
    if (!meta) continue;

    let metaStatus: TemplateMetaStatus = "pending";
    if (meta.status === "APPROVED") metaStatus = "approved";
    else if (meta.status === "REJECTED") metaStatus = "rejected";
    else if (meta.status === "PAUSED") metaStatus = "paused";

    if (metaStatus === tpl.meta_status) continue;

    await supabase
      .from("whatsapp_templates")
      .update({
        meta_status: metaStatus,
        rejection_reason: meta.reason ?? null,
        approved_at: metaStatus === "approved" ? now : null,
        updated_at: now,
      })
      .eq("id", tpl.id);

    synced++;
  }

  return synced;
}

import { countBodyVariables } from "./template-utils";