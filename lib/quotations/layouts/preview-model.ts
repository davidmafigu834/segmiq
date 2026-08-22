import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { solarTemplateFixture } from "./fixtures";
import { str } from "./map-fields";
import { isSolarLayout } from "./registry";
import type { QuoteDocumentModel } from "./types";

/**
 * Full visual preview of a solar template for quotation settings.
 * Uses sample customer/site/KPI/item data so every layout block is visible.
 * Overlays the viewing company's brand. Never writes a real quotation.
 */
export async function buildSolarTemplatePreviewModel(
  supabase: SupabaseClient,
  clientId: string
): Promise<QuoteDocumentModel> {
  const model = solarTemplateFixture("populated", { heroAsUrl: true });
  const [{ data: client }, settings] = await Promise.all([
    supabase.from("clients").select("name, logo_url").eq("id", clientId).maybeSingle(),
    ensureQuotationSettings(supabase, clientId),
  ]);

  const companyName = str(client?.name) || model.company.name;
  const phone = str(settings.company_phone);
  const email = str(settings.company_email);
  const website = str(settings.company_website);
  const address = str(settings.company_address);
  const logoUrl = str(client?.logo_url);
  const signatoryName = str(settings.authorised_signatory_name);
  const signatoryRole = str(settings.authorised_signatory_role);

  return {
    ...model,
    company: {
      ...model.company,
      name: companyName,
      tagline: companyName === model.company.name ? model.company.tagline : null,
      logoUrl,
      logoDataUri: null,
      phone: phone ?? model.company.phone,
      email: email ?? model.company.email,
      website: website ?? model.company.website,
      address: address ?? model.company.address,
      signatoryName: signatoryName ?? (companyName === model.company.name ? model.company.signatoryName : null),
      signatoryRole: signatoryRole ?? (companyName === model.company.name ? model.company.signatoryRole : null),
    },
    quote: {
      ...model.quote,
      number: "SAMPLE",
      status: "preview",
    },
    footerContacts: [
      phone ?? model.company.phone ? { kind: "phone" as const, value: phone ?? model.company.phone! } : null,
      email ?? model.company.email ? { kind: "email" as const, value: email ?? model.company.email! } : null,
      website ?? model.company.website ? { kind: "web" as const, value: website ?? model.company.website! } : null,
      address ?? model.company.address
        ? { kind: "address" as const, value: address ?? model.company.address! }
        : null,
    ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
  };
}

export function canPreviewTemplateLayout(layoutKey: string | null | undefined, builtinKey: string | null | undefined) {
  return isSolarLayout(layoutKey) || isSolarLayout(builtinKey);
}
