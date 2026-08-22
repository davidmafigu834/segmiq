import { computeLine, computeQuotationTotals } from "@/lib/quotations/totals";
import { amountInWords } from "./amount-in-words";
import { publicFileToDataUri } from "./resolve-image";
import { RESIDENTIAL_PREMIUM_SOLAR_DEFAULTS } from "./registry";
import {
  RESIDENTIAL_PREMIUM_SOLAR_KEY,
  RESIDENTIAL_PREMIUM_SOLAR_VERSION,
  TEMPLATE_LIME,
  type QuoteDocumentItem,
  type QuoteDocumentModel,
} from "./types";
import { solarMetrics, siteRows } from "./map-fields";
import { SOLAR_BUILTIN_STARTER_ITEMS } from "./builtin-starter";

type FixtureKind = "populated" | "minimal" | "long" | "multipage";

function moneyItems(
  rows: Array<{
    name: string;
    description?: string;
    brandModel?: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    sectionTitle: string | null;
    optional?: boolean;
  }>,
  taxRate: number
): QuoteDocumentItem[] {
  return rows.map((row, index) => {
    const computed = computeLine(
      { unit_price: row.unitPrice, quantity: row.quantity, is_optional: Boolean(row.optional) },
      taxRate
    );
    return {
      index: index + 1,
      name: row.name,
      description: row.description ?? null,
      brandModel: row.brandModel ?? null,
      quantity: row.quantity,
      unit: row.unit ?? "Each",
      unitPrice: row.unitPrice,
      amount: computed.netBeforeTax,
      sectionTitle: row.sectionTitle,
      optional: Boolean(row.optional),
    };
  });
}

function groupSections(items: QuoteDocumentItem[]) {
  const map = new Map<string, QuoteDocumentItem[]>();
  for (const item of items.filter((it) => !it.optional)) {
    const key = item.sectionTitle || "";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([title, list]) => ({
    title: title || null,
    items: list,
  }));
}

function baseCompany(overrides?: Partial<QuoteDocumentModel["company"]>): QuoteDocumentModel["company"] {
  return {
    name: "Northridge Energy",
    tagline: "Reliable solar for every home.",
    logoDataUri: null,
    logoUrl: null,
    phone: "+1 415 555 0142",
    email: "quotes@northridge.test",
    website: "www.northridge.test",
    address: "88 Harbour Way, Cape Town",
    signatoryName: "Maya Petersen",
    signatoryRole: "Director",
    signatureDataUri: null,
    ...overrides,
  };
}

function commercialFrom(
  items: QuoteDocumentItem[],
  taxRate: number,
  discountPercent = 0
): QuoteDocumentModel["commercial"] {
  const totals = computeQuotationTotals(
    items.map((it) => ({
      unit_price: it.unitPrice,
      quantity: it.quantity,
      is_optional: it.optional,
    })),
    { fallbackTaxRate: taxRate, discountPercent }
  );
  return {
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxAmount: totals.taxAmount,
    taxRate,
    otherAmount: 0,
    optionalSelected: 0,
    total: totals.total,
    amountInWords: amountInWords(totals.total, "USD"),
  };
}

function populatedItems() {
  return moneyItems(
    SOLAR_BUILTIN_STARTER_ITEMS.map((it) => ({
      name: it.item_name,
      description: it.description ?? undefined,
      brandModel: it.sku ?? undefined,
      quantity: it.quantity,
      unit: it.unit ?? undefined,
      unitPrice: it.unit_price,
      sectionTitle: it.group_label ?? null,
    })),
    15
  );
}

const MULTIPAGE_TERMS = [
  "1. This quotation is valid until the date shown and is subject to a confirmatory site survey.",
  "2. Prices exclude unforeseen structural reinforcement, electrical upgrades, or municipal fees unless listed as line items.",
  "3. Equipment warranties are those of the respective manufacturers and are passed through at handover.",
  "4. Installation dates are scheduled after the deposit is received and material lead times are confirmed.",
  "5. The customer is responsible for providing safe roof access and a suitable AC connection point.",
  "6. Any variation to scope will be quoted in writing before work proceeds.",
  "7. Retention, if applicable, is released against documented completion of commissioning.",
  "8. This document is a commercial offer and does not constitute an installation permit or grid-connection approval.",
].join("\n");

export function solarTemplateFixture(
  kind: FixtureKind,
  opts?: { heroAsUrl?: boolean }
): QuoteDocumentModel {
  const heroSrc = opts?.heroAsUrl
    ? "/quotation-templates/residential-premium-solar/hero.png"
    : publicFileToDataUri("/quotation-templates/residential-premium-solar/hero.png");
  const presentation = RESIDENTIAL_PREMIUM_SOLAR_DEFAULTS;

  if (kind === "minimal") {
    const items = moneyItems(
      [
        { name: "Solar modules", quantity: 8, unitPrice: 160, sectionTitle: null },
        { name: "Installation", quantity: 1, unit: "Lot", unitPrice: 750, sectionTitle: null },
      ],
      0
    );
    return {
      layoutKey: RESIDENTIAL_PREMIUM_SOLAR_KEY,
      layoutVersion: RESIDENTIAL_PREMIUM_SOLAR_VERSION,
      badge: presentation.badge,
      accent: TEMPLATE_LIME,
      company: baseCompany({ tagline: null, signatoryName: null, signatoryRole: null }),
      quote: {
        number: "QT-FIXTURE-MIN",
        version: 1,
        issuedAt: "2026-08-01",
        validUntil: "2026-08-31",
        currency: "USD",
        status: "draft",
      },
      customer: {
        name: "Sam Okello",
        company: null,
        phone: "+263 77 000 0101",
        email: "sam.okello@example.test",
        address: null,
      },
      site: [],
      projectSummary: "Supply and installation of a residential solar system as specified below.",
      hero: {
        headline: presentation.heroHeadline,
        subcopy: presentation.heroSubcopy,
        accentWord: presentation.heroAccentWord,
        imageSrc: heroSrc,
      },
      metrics: [],
      sections: groupSections(items),
      optionalItems: [],
      paymentTerms: [{ label: "50% deposit, balance on completion", detail: null, amountLabel: null }],
      warranty: [],
      commercial: commercialFrom(items, 0),
      terms: null,
      showAcceptance: true,
      showPoweredBy: false,
      footerContacts: [
        { kind: "phone", value: "+1 415 555 0142" },
        { kind: "email", value: "quotes@northridge.test" },
      ],
      readiness: [],
    };
  }

  const fields = {
    site_address: "14 Willow Ridge, Constantia",
    property_type: "Residential",
    roof_type: "Tile",
    roof_area: "92 m²",
    roof_orientation: "North",
    roof_tilt: "26°",
    shade_level: "Low",
    net_metering: "Available",
    system_size_kwp: 6.6,
    generation_kwh_month: 900,
    generation_kwh_year: 10800,
    performance_ratio: 80,
    co2_offset_tonnes_year: 8.6,
  };

  if (kind === "long") {
    const extra = moneyItems(
      [
        { name: "Monitoring gateway", quantity: 1, unitPrice: 180, sectionTitle: "Equipment" },
        { name: "Earthing & lightning protection", quantity: 1, unitPrice: 210, sectionTitle: "Installation" },
        { name: "Scaffolding & access", quantity: 1, unit: "Lot", unitPrice: 150, sectionTitle: "Installation" },
        { name: "Transport to site", quantity: 1, unit: "Lot", unitPrice: 95, sectionTitle: "Installation" },
        { name: "Training & handover pack", quantity: 1, unit: "Lot", unitPrice: 80, sectionTitle: "Installation" },
      ],
      15
    );
    const items = [...populatedItems(), ...extra].map((it, index) => ({ ...it, index: index + 1 }));
    const optional = moneyItems(
      [{ name: "Additional 5.12kWh battery", quantity: 1, unitPrice: 1420, sectionTitle: null, optional: true }],
      15
    );
    return {
      layoutKey: RESIDENTIAL_PREMIUM_SOLAR_KEY,
      layoutVersion: RESIDENTIAL_PREMIUM_SOLAR_VERSION,
      badge: presentation.badge,
      accent: TEMPLATE_LIME,
      company: baseCompany({
        name: "Northridge Renewable Energy Solutions Group",
        address: "88 Harbour Way, Waterfront Business Park, Cape Town, 8001",
      }),
      quote: {
        number: "QT-FIXTURE-LONG",
        version: 2,
        issuedAt: "2026-08-01",
        validUntil: "2026-09-15",
        currency: "USD",
        status: "draft",
      },
      customer: {
        name: "Catherine Elizabeth Montgomery-Steele",
        company: null,
        phone: "+27 82 555 0199",
        email: "c.montgomery-steele@longexample.test",
        address: "Unit 14B, The Oaks Retirement Village, 221 Constantia Main Road, Cape Town, 7806",
      },
      site: siteRows({ ...fields, site_address: "Unit 14B, The Oaks Retirement Village, 221 Constantia Main Road" }, true),
      projectSummary:
        "Design, supply, installation and commissioning of a residential solar and battery system for this property, including array, hybrid inverter, storage, mounting, protection, testing and handover as specified in the equipment schedule.",
      hero: {
        headline: presentation.heroHeadline,
        subcopy: presentation.heroSubcopy,
        accentWord: presentation.heroAccentWord,
        imageSrc: heroSrc,
      },
      metrics: solarMetrics(fields, true),
      sections: groupSections(items),
      optionalItems: optional,
      paymentTerms: [
        { label: "Advance", amountLabel: "10%", detail: "With order" },
        { label: "Materials", amountLabel: "20%", detail: "On procurement" },
        { label: "Progress", amountLabel: "30%", detail: "Before installation" },
        { label: "Commissioning", amountLabel: "25%", detail: "After testing" },
        { label: "Handover", amountLabel: "10%", detail: "On completion" },
        { label: "Retention", amountLabel: "5%", detail: "30 days after handover" },
      ],
      warranty: [
        { label: "PV Modules", detail: "12-year product / 25-year performance (manufacturer)" },
        { label: "Inverter", detail: "As specified by manufacturer warranty" },
        { label: "Battery", detail: "As specified by manufacturer warranty" },
        { label: "Workmanship", detail: "2 years" },
      ],
      commercial: commercialFrom([...items, ...optional], 15, 3),
      terms:
        "1. This quotation is valid until the date shown and is subject to site survey confirmation.\n2. Prices exclude unforeseen structural reinforcement or municipal fees unless listed.\n3. Equipment warranties are those of the respective manufacturers and are passed through at handover.\n4. Installation dates are scheduled after deposit and material lead times are confirmed.\n5. The customer is responsible for providing safe roof access and a suitable AC connection point.\n6. Any variation to scope will be quoted before work proceeds.\n7. Retention, if applicable, is released against documented completion of commissioning.",
      showAcceptance: true,
      showPoweredBy: false,
      footerContacts: [
        { kind: "phone", value: "+1 415 555 0142" },
        { kind: "email", value: "quotes@northridge.test" },
        { kind: "web", value: "www.northridge.test" },
        { kind: "address", value: "88 Harbour Way, Waterfront Business Park, Cape Town" },
      ],
      readiness: [],
    };
  }

  const items = populatedItems();
  const populated: QuoteDocumentModel = {
    layoutKey: RESIDENTIAL_PREMIUM_SOLAR_KEY,
    layoutVersion: RESIDENTIAL_PREMIUM_SOLAR_VERSION,
    badge: presentation.badge,
    accent: TEMPLATE_LIME,
    company: baseCompany(),
    quote: {
      number: "QT-FIXTURE-FULL",
      version: 1,
      issuedAt: "2026-08-01",
      validUntil: "2026-08-31",
      currency: "USD",
      status: "draft",
    },
    customer: {
      name: "Jordan Hale",
      company: null,
      phone: "+27 71 555 0188",
      email: "jordan.hale@example.test",
      address: "14 Willow Ridge, Constantia",
    },
    site: siteRows(fields, true),
    projectSummary:
      "Design, supply, installation and commissioning of a 6.6 kWp residential solar and battery system for this property, as specified in the equipment schedule.",
    hero: {
      headline: presentation.heroHeadline,
      subcopy: presentation.heroSubcopy,
      accentWord: presentation.heroAccentWord,
      imageSrc: heroSrc,
    },
    metrics: solarMetrics(fields, true),
    sections: groupSections(items),
    optionalItems: [],
    paymentTerms: [
      { label: "Advance", amountLabel: "10%", detail: "With order" },
      { label: "Progress", amountLabel: "60%", detail: "Before installation" },
      { label: "Completion", amountLabel: "30%", detail: "After commissioning" },
    ],
    warranty: [
      { label: "PV Modules", detail: "Manufacturer warranty as specified" },
      { label: "Inverter", detail: "Manufacturer warranty as specified" },
      { label: "Workmanship", detail: "2 years" },
    ],
    commercial: commercialFrom(items, 15),
    terms: "Prices are valid until the date shown. Manufacturer warranties apply at handover.",
    showAcceptance: true,
    showPoweredBy: false,
    footerContacts: [
      { kind: "phone", value: "+1 415 555 0142" },
      { kind: "email", value: "quotes@northridge.test" },
      { kind: "web", value: "www.northridge.test" },
      { kind: "address", value: "88 Harbour Way, Cape Town" },
    ],
    readiness: [],
  };

  if (kind === "multipage") {
    return {
      ...populated,
      quote: { ...populated.quote, number: "QT-FIXTURE-P2" },
      terms: MULTIPAGE_TERMS,
    };
  }

  return populated;
}

export const SOLAR_TEMPLATE_FIXTURE_KINDS: FixtureKind[] = ["populated", "minimal", "long", "multipage"];
