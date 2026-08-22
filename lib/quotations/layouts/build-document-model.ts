import type { SupabaseClient } from "@supabase/supabase-js";
import { computeLine, computeQuotationTotals, type LineCommercialInput } from "@/lib/quotations/totals";
import { ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { amountInWords } from "./amount-in-words";
import { resolveDocumentAccent } from "./accent";
import { getBuiltinTemplate, mergePresentation, RESIDENTIAL_PREMIUM_SOLAR_DEFAULTS } from "./registry";
import { STANDARD_LAYOUT_KEY } from "./types";
import type {
  QuoteDocumentItem,
  QuoteDocumentModel,
  QuoteDocumentSection,
  TemplatePresentation,
} from "./types";
import {
  brandModelFromItem,
  defaultSummary,
  num,
  paymentsFromQuote,
  siteRows,
  solarMetrics,
  str,
  warrantyFromQuote,
} from "./map-fields";
import { fetchRasterDataUri, publicFileToDataUri, resolveHeroRasterSrc } from "./resolve-image";

export async function buildQuoteDocumentModel(
  supabase: SupabaseClient,
  quotationId: string,
  opts?: { origin?: string | null; ignoreFreeze?: boolean; preferUrls?: boolean }
): Promise<QuoteDocumentModel | null> {
  const { data: quote } = await supabase.from("quotations").select("*").eq("id", quotationId).maybeSingle();
  if (!quote) return null;

  const frozen = (quote.presentation_snapshot ?? null) as Record<string, unknown> | null;
  const sent = ["sent", "viewed", "accepted", "rejected", "expired", "superseded"].includes(String(quote.status));
  const useFreeze = Boolean(!opts?.ignoreFreeze && sent && frozen && typeof frozen === "object");

  const clientId = quote.client_id as string;
  const [{ data: items }, { data: client }, { data: lead }, { data: deal }] = await Promise.all([
    supabase
      .from("quotation_line_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true }),
    supabase.from("clients").select("name, logo_url, primary_color").eq("id", clientId).maybeSingle(),
    supabase
      .from("leads")
      .select("name, phone, email, location")
      .eq("id", quote.lead_id as string)
      .maybeSingle(),
    quote.deal_id
      ? supabase
          .from("deals")
          .select("name, service_summary, location")
          .eq("id", quote.deal_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const settings = await ensureQuotationSettings(supabase, clientId);

  let liveLayoutKey = str(quote.template_layout_key);
  let livePresentationOverride: Record<string, unknown> | null = null;
  if (!useFreeze && quote.template_id) {
    const { data: tmpl } = await supabase
      .from("quote_templates")
      .select("presentation, layout_key, builtin_key")
      .eq("id", quote.template_id as string)
      .maybeSingle();
    liveLayoutKey =
      liveLayoutKey ||
      str(tmpl?.layout_key) ||
      str(tmpl?.builtin_key);
    livePresentationOverride = (tmpl?.presentation as Record<string, unknown>) ?? null;
  }

  const layoutKey =
    str(useFreeze ? frozen?.layoutKey : liveLayoutKey) || STANDARD_LAYOUT_KEY;
  const builtin = getBuiltinTemplate(layoutKey);

  const fields = useFreeze
    ? { ...((frozen?.fields as Record<string, unknown>) ?? {}) }
    : { ...((quote.template_fields as Record<string, unknown> | null) ?? {}) };
  if (!useFreeze && str(quote.project_summary) && !str(fields.project_summary)) {
    fields.project_summary = quote.project_summary;
  }

  let presentation: TemplatePresentation = mergePresentation(
    builtin?.defaultPresentation ?? RESIDENTIAL_PREMIUM_SOLAR_DEFAULTS,
    useFreeze ? (frozen?.presentation as Record<string, unknown>) : livePresentationOverride
  );

  const companyFrozen = (useFreeze ? frozen?.company : null) as Record<string, unknown> | null;
  const companyName = str(companyFrozen?.name) ?? str(client?.name) ?? "Company";
  const tagline = str(companyFrozen?.tagline) ?? null;
  const liveLogo = (client?.logo_url as string | null) ?? null;
  const logoDataUri =
    str(companyFrozen?.logoDataUri) ??
    (useFreeze ? null : opts?.preferUrls ? liveLogo : await fetchRasterDataUri(liveLogo));
  const accent = resolveDocumentAccent(
    str(companyFrozen?.accent) ?? (client?.primary_color as string | null),
    presentation.accent
  );

  const origin = opts?.origin?.replace(/\/$/, "") ?? "";
  const defaultHero = builtin?.defaultHeroSrc ?? null;
  const preferredHero =
    str(fields.hero_image_url) ?? presentation.heroImageUrl ?? str(companyFrozen?.heroImageDataUri) ?? str(companyFrozen?.heroImageSrc);
  const heroSrc = opts?.preferUrls && !useFreeze
    ? preferredHero || (defaultHero ? `${origin}${defaultHero}` : null)
    : useFreeze
      ? str(companyFrozen?.heroImageDataUri) ??
        (await resolveHeroRasterSrc(preferredHero, defaultHero, origin))
      : await resolveHeroRasterSrc(preferredHero, defaultHero, origin);

  const lineInputs: LineCommercialInput[] = (items ?? []).map((it) => ({
    unit_price: Number(it.unit_price) || 0,
    quantity: Number(it.quantity) || 0,
    discount_percent: Number(it.discount_percent) || 0,
    discount_amount: Number(it.discount_amount) || 0,
    tax_rate: it.tax_rate != null ? Number(it.tax_rate) : null,
    tax_inclusive: Boolean(it.tax_inclusive),
    is_optional: Boolean(it.is_optional),
  }));
  const totals = computeQuotationTotals(lineInputs, {
    fallbackTaxRate: Number(quote.tax_rate) || 0,
    otherAmount: Number(quote.other_amount) || 0,
    discountPercent: Number(quote.discount_percent) || 0,
  });

  const mappedItems: QuoteDocumentItem[] = (items ?? []).map((it, index) => {
    const name = String(it.item_name ?? "");
    const description = str(it.description);
    const computed = computeLine(
      {
        unit_price: Number(it.unit_price) || 0,
        quantity: Number(it.quantity) || 0,
        discount_percent: Number(it.discount_percent) || 0,
        discount_amount: Number(it.discount_amount) || 0,
        tax_rate: it.tax_rate != null ? Number(it.tax_rate) : null,
        tax_inclusive: Boolean(it.tax_inclusive),
        is_optional: Boolean(it.is_optional),
      },
      Number(quote.tax_rate) || 0
    );
    return {
      id: str(it.id) ?? undefined,
      index: index + 1,
      name,
      description,
      brandModel: brandModelFromItem(name, str(it.sku), description),
      quantity: Number(it.quantity) || 0,
      unit: str(it.unit) || "Each",
      unitPrice: Number(it.unit_price) || 0,
      amount: computed.netBeforeTax,
      sectionTitle: str(it.group_label),
      optional: Boolean(it.is_optional),
    };
  });
  const baseItems = mappedItems.filter((it) => !it.optional);
  const optionalItems = mappedItems.filter((it) => it.optional);
  const sectionMap = new Map<string, QuoteDocumentItem[]>();
  for (const item of baseItems) {
    const key = item.sectionTitle || "";
    const list = sectionMap.get(key) ?? [];
    list.push(item);
    sectionMap.set(key, list);
  }
  const sections: QuoteDocumentSection[] = Array.from(sectionMap.entries()).map(([title, list]) => ({
    title: title || null,
    items: list,
  }));

  const customerAddress =
    str(fields.customer_address) ?? str(lead?.location) ?? str(deal?.location) ?? null;

  const size = num(fields.system_size_kwp);
  const projectSummary = presentation.showSummary
    ? defaultSummary(fields, str(deal?.service_summary) ?? str(deal?.name), size)
    : null;

  const phone = str(companyFrozen?.phone) ?? str(settings.company_phone);
  const email = str(companyFrozen?.email) ?? str(settings.company_email);
  const website = str(companyFrozen?.website) ?? str(settings.company_website);
  const address = str(companyFrozen?.address) ?? str(settings.company_address);

  const metrics = solarMetrics(fields, presentation.showMetrics);
  const paymentTerms = paymentsFromQuote(quote as Record<string, unknown>);
  const warranty = warrantyFromQuote(quote as Record<string, unknown>, fields, presentation.showWarranty);

  const headline = str(fields.hero_headline) ?? presentation.heroHeadline;
  const subcopy = str(fields.hero_subcopy) ?? presentation.heroSubcopy;

  const readiness = [
    { id: "customer", label: "Customer information", ok: Boolean(str(quote.customer_name) ?? str(lead?.name)), optional: false },
    { id: "items", label: "Equipment", ok: baseItems.length > 0, optional: false },
    { id: "payment", label: "Payment terms", ok: paymentTerms.length > 0, optional: false },
    { id: "summary", label: "Project information", ok: Boolean(projectSummary), optional: true },
    { id: "metrics", label: "Solar generation estimate", ok: metrics.length > 0, optional: true },
    { id: "hero", label: "Hero image", ok: Boolean(heroSrc) || Boolean(defaultHero && publicFileToDataUri(defaultHero)), optional: true },
  ];

  return {
    layoutKey: builtin ? layoutKey : STANDARD_LAYOUT_KEY,
    layoutVersion: builtin?.layoutVersion ?? 1,
    badge: presentation.showBadge ? presentation.badge : null,
    accent,
    company: {
      name: companyName,
      tagline,
      logoDataUri,
      logoUrl: useFreeze ? null : liveLogo,
      phone,
      email,
      website,
      address,
      signatoryName: str((settings as Record<string, unknown>).authorised_signatory_name) ?? str(quote.prepared_by_name),
      signatoryRole: str((settings as Record<string, unknown>).authorised_signatory_role),
      signatureDataUri: str(companyFrozen?.signatureDataUri) ?? null,
    },
    quote: {
      number: str(quote.quote_number) || "DRAFT",
      version: Number(quote.revision_number) || 1,
      issuedAt: str(quote.sent_at) ?? str(quote.created_at),
      validUntil: str(quote.valid_until),
      currency: str(quote.currency) || "USD",
      status: String(quote.status),
    },
    customer: {
      name: str(quote.customer_name) ?? str(lead?.name),
      company: null,
      phone: str(quote.customer_phone) ?? str(lead?.phone),
      email: str(quote.customer_email) ?? str(lead?.email),
      address: customerAddress,
    },
    site: siteRows(fields, presentation.showSite),
    projectSummary,
    hero: {
      headline,
      subcopy,
      accentWord: presentation.heroAccentWord || null,
      imageSrc: heroSrc,
    },
    metrics,
    sections,
    optionalItems,
    paymentTerms,
    warranty,
    commercial: {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxAmount: totals.taxAmount,
      taxRate: Number(quote.tax_rate) || 0,
      otherAmount: Number(quote.other_amount) || 0,
      optionalSelected: 0,
      total: totals.total,
      amountInWords: presentation.showAmountInWords
        ? amountInWords(totals.total, str(quote.currency) || "USD")
        : null,
    },
    terms: str(quote.terms_snapshot) ?? str(quote.terms),
    showAcceptance: presentation.showAcceptance,
    showPoweredBy: presentation.showPoweredBy,
    footerContacts: [
      phone ? { kind: "phone" as const, value: phone } : null,
      email ? { kind: "email" as const, value: email } : null,
      website ? { kind: "web" as const, value: website } : null,
      address ? { kind: "address" as const, value: address } : null,
    ].filter((row): row is NonNullable<typeof row> => Boolean(row)),
    readiness,
  };
}

export async function capturePresentationSnapshot(
  supabase: SupabaseClient,
  quotationId: string,
  origin?: string | null
): Promise<Record<string, unknown> | null> {
  const { data: quote } = await supabase
    .from("quotations")
    .select("template_fields, template_layout_key, template_id, project_summary")
    .eq("id", quotationId)
    .maybeSingle();
  if (!quote) return null;

  const model = await buildQuoteDocumentModel(supabase, quotationId, { origin, ignoreFreeze: true });
  if (!model) return null;

  const fields = {
    ...((quote.template_fields as Record<string, unknown> | null) ?? {}),
  };
  if (str(quote.project_summary) && !str(fields.project_summary)) {
    fields.project_summary = quote.project_summary;
  }

  const { data: tmpl } = quote.template_id
    ? await supabase
        .from("quote_templates")
        .select("presentation")
        .eq("id", quote.template_id as string)
        .maybeSingle()
    : { data: null };
  const presentation = mergePresentation(
    getBuiltinTemplate(model.layoutKey)?.defaultPresentation ?? RESIDENTIAL_PREMIUM_SOLAR_DEFAULTS,
    (tmpl?.presentation as Record<string, unknown>) ?? null
  );

  return {
    layoutKey: model.layoutKey,
    layoutVersion: model.layoutVersion,
    presentation: {
      ...presentation,
      heroHeadline: model.hero.headline,
      heroSubcopy: model.hero.subcopy,
      heroAccentWord: model.hero.accentWord,
      heroImageUrl: model.hero.imageSrc,
      accent: model.accent,
    },
    fields,
    company: {
      name: model.company.name,
      tagline: model.company.tagline,
      logoDataUri: model.company.logoDataUri,
      phone: model.company.phone,
      email: model.company.email,
      website: model.company.website,
      address: model.company.address,
      accent: model.accent,
      heroImageSrc: model.hero.imageSrc,
      heroImageDataUri: model.hero.imageSrc?.startsWith("data:") ? model.hero.imageSrc : null,
      signatureDataUri: model.company.signatureDataUri,
    },
    capturedAt: new Date().toISOString(),
  };
}
