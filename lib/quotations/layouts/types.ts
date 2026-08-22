export const RESIDENTIAL_PREMIUM_SOLAR_KEY = "residential-premium-solar";
export const STANDARD_LAYOUT_KEY = "standard";
export const RESIDENTIAL_PREMIUM_SOLAR_VERSION = 1;

export const TEMPLATE_LIME = "#A3C639";
export const TEMPLATE_INK = "#1A1A1A";
export const TEMPLATE_MUTED = "#6B6B6B";
export const TEMPLATE_LINE = "#E4E4E4";
export const TEMPLATE_CHARCOAL = "#2A2A2A";

export type TemplateFieldKind = "text" | "number" | "select";

export type TemplateFieldDef = {
  key: string;
  label: string;
  group: "site" | "performance" | "copy";
  kind: TemplateFieldKind;
  optional: boolean;
  unit?: string;
  options?: string[];
};

export type TemplatePresentation = {
  badge: string;
  showBadge: boolean;
  heroHeadline: string;
  heroSubcopy: string;
  heroAccentWord: string;
  heroImageUrl: string | null;
  showSite: boolean;
  showSummary: boolean;
  showMetrics: boolean;
  showWarranty: boolean;
  showAcceptance: boolean;
  showAmountInWords: boolean;
  showPoweredBy: boolean;
  accent: string;
};

export type BuiltinTemplateDefinition = {
  key: string;
  name: string;
  category: string;
  description: string;
  longDescription: string;
  layoutVersion: number;
  fieldSchema: TemplateFieldDef[];
  defaultPresentation: TemplatePresentation;
  thumbnailSrc: string;
  defaultHeroSrc: string;
};

export type QuoteDocumentMetric = {
  id: string;
  label: string;
  value: string;
  secondary: string | null;
};

export type QuoteDocumentItem = {
  id?: string;
  index: number;
  name: string;
  description: string | null;
  brandModel: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  sectionTitle: string | null;
  optional: boolean;
};

export type QuoteDocumentSection = {
  title: string | null;
  items: QuoteDocumentItem[];
};

export type QuoteDocumentPayment = {
  label: string;
  detail: string | null;
  amountLabel?: string | null;
};

export type QuoteDocumentWarranty = {
  label: string;
  detail: string;
};

export type QuoteDocumentModel = {
  layoutKey: string;
  layoutVersion: number;
  badge: string | null;
  accent: string;
  company: {
    name: string;
    tagline: string | null;
    logoDataUri: string | null;
    logoUrl: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    signatoryName: string | null;
    signatoryRole: string | null;
    signatureDataUri: string | null;
  };
  quote: {
    number: string;
    version: number;
    issuedAt: string | null;
    validUntil: string | null;
    currency: string;
    status: string;
  };
  customer: {
    name: string | null;
    company: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  site: Array<{ label: string; value: string }>;
  projectSummary: string | null;
  hero: {
    headline: string;
    subcopy: string | null;
    accentWord: string | null;
    imageSrc: string | null;
  };
  metrics: QuoteDocumentMetric[];
  sections: QuoteDocumentSection[];
  optionalItems: QuoteDocumentItem[];
  paymentTerms: QuoteDocumentPayment[];
  warranty: QuoteDocumentWarranty[];
  commercial: {
    subtotal: number;
    discountTotal: number;
    taxAmount: number;
    taxRate: number;
    otherAmount: number;
    optionalSelected: number;
    total: number;
    amountInWords: string | null;
  };
  terms: string | null;
  showAcceptance: boolean;
  showPoweredBy: boolean;
  footerContacts: Array<{ kind: "phone" | "email" | "web" | "address"; value: string }>;
  readiness: Array<{ id: string; label: string; ok: boolean; optional: boolean }>;
};
