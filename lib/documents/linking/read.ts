import { createAdminClient } from "@/lib/supabase/admin";
import { buildEntityHref, entityTypeLabel } from "@/lib/documents/linking/hrefs";
import type {
  DocumentEntityLinkRow,
  DocumentEntityType,
  EnrichedDocumentEntityLink,
} from "@/lib/documents/linking/types";

async function enrichLink(
  row: DocumentEntityLinkRow,
  clientId: string
): Promise<EnrichedDocumentEntityLink> {
  const supabase = createAdminClient();
  let label = entityTypeLabel(row.entity_type);
  let subtitle: string | null = row.match_reason;

  switch (row.entity_type as DocumentEntityType) {
    case "CUSTOMER": {
      const { data } = await supabase
        .from("contacts")
        .select("name, email, location, lifecycle")
        .eq("id", row.entity_id)
        .maybeSingle();
      label = (data?.name as string) ?? label;
      subtitle =
        [data?.location, data?.email].filter(Boolean).join(" · ") || row.match_reason;
      break;
    }
    case "LEAD": {
      const { data } = await supabase
        .from("leads")
        .select("name, status, project_type")
        .eq("id", row.entity_id)
        .maybeSingle();
      label = (data?.name as string) ?? label;
      subtitle = [data?.status, data?.project_type].filter(Boolean).join(" · ") || row.match_reason;
      break;
    }
    case "DEAL": {
      const { data } = await supabase
        .from("deals")
        .select("name, stage, location")
        .eq("id", row.entity_id)
        .maybeSingle();
      label = (data?.name as string) ?? label;
      subtitle = [data?.stage, data?.location].filter(Boolean).join(" · ") || row.match_reason;
      break;
    }
    case "QUOTATION": {
      const { data } = await supabase
        .from("quotations")
        .select("quote_number, customer_name, status")
        .eq("id", row.entity_id)
        .maybeSingle();
      label = (data?.quote_number as string) ?? label;
      subtitle = [data?.customer_name, data?.status].filter(Boolean).join(" · ") || row.match_reason;
      break;
    }
    default:
      break;
  }

  return {
    ...row,
    label,
    subtitle,
    href: buildEntityHref(row.entity_type, row.entity_id, clientId),
  };
}

export async function loadDocumentEntityLinks(
  clientId: string,
  documentId: string
): Promise<EnrichedDocumentEntityLink[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("document_entity_links")
    .select("*")
    .eq("client_id", clientId)
    .eq("document_id", documentId)
    .order("confirmed", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (data as DocumentEntityLinkRow[]) ?? [];
  return Promise.all(rows.map((row) => enrichLink(row, clientId)));
}
