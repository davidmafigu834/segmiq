import { createAdminClient } from "@/lib/supabase/admin";
import { fbLog } from "@/lib/facebook/log";

type ResolvedClient = {
  id: string;
  name: string;
  dial_code: string | null;
  assignment_mode: string;
};

function mapClient(row: {
  id: string;
  name: string;
  dial_code: string | null;
  assignment_mode: string | null;
}): ResolvedClient {
  return {
    id: row.id as string,
    name: row.name as string,
    dial_code: (row.dial_code as string | null) ?? null,
    assignment_mode: (row.assignment_mode as string) ?? "direct",
  };
}

export async function resolveClientFromWhatsAppPhoneNumberId(
  phoneNumberId: string | null | undefined
): Promise<ResolvedClient | null> {
  const id = phoneNumberId?.trim();
  if (!id) return null;

  const supabase = createAdminClient();

  const { data: direct } = await supabase
    .from("clients")
    .select("id, name, dial_code, assignment_mode, is_active, is_archived")
    .eq("meta_whatsapp_phone_number_id", id)
    .maybeSingle();

  if (direct && direct.is_active !== false && !direct.is_archived) {
    return mapClient(direct);
  }

  const envId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (envId && envId === id) {
    const { data: actives } = await supabase
      .from("clients")
      .select("id, name, dial_code, assignment_mode, is_active, is_archived, meta_whatsapp_phone_number_id")
      .eq("is_active", true)
      .or("is_archived.is.null,is_archived.eq.false");

    const eligible = (actives ?? []).filter((c) => !c.is_archived);
    if (eligible.length === 1) {
      const only = eligible[0];
      if (!only.meta_whatsapp_phone_number_id) {
        await supabase
          .from("clients")
          .update({ meta_whatsapp_phone_number_id: id, updated_at: new Date().toISOString() })
          .eq("id", only.id as string);
        fbLog("fb.whatsapp.client_auto_linked", { clientId: only.id, phoneNumberId: id });
      }
      return mapClient(only);
    }
  }

  fbLog("fb.whatsapp.no_client_match", { phoneNumberId: id });
  return null;
}
