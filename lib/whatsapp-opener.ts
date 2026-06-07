// Category mapping based on clients.industry
export type OpenerCategory =
  | "SOLAR"
  | "CONSTRUCTION"
  | "ROOFING"
  | "ELECTRICAL"
  | "LANDSCAPING"
  | "GENERIC";

export type UrgencyTier = "exploring" | "soon" | "urgent" | "neutral";

export function mapIndustryToCategory(industry: string | null | undefined): OpenerCategory {
  const i = (industry || "").toLowerCase();
  if (i.includes("solar")) return "SOLAR";
  if (i.includes("construct")) return "CONSTRUCTION";
  if (i.includes("roof")) return "ROOFING";
  if (i.includes("electric")) return "ELECTRICAL";
  if (i.includes("landscap")) return "LANDSCAPING";
  return "GENERIC";
}

/** Mid-sentence niche fragment keyed by opener category (derived from clients.industry). */
const NICHE_PROJECT_LABELS: Record<Exclude<OpenerCategory, "GENERIC">, string> = {
  SOLAR: "solar installation",
  CONSTRUCTION: "construction",
  ROOFING: "roofing",
  ELECTRICAL: "electrical",
  LANDSCAPING: "landscaping",
};

// Phase A templates — complete GENERIC set (fallback)
const TEMPLATES: Record<OpenerCategory, Record<UrgencyTier, string>> = {
  GENERIC: {
    exploring:
      "Hi {{lead_first_name}}, {{rep_intro}}. Saw your enquiry about {{project_phrase}}{{location}} — when would be a good time to chat?",
    soon:
      "Hi {{lead_first_name}}, {{rep_intro}}. Thanks for reaching out about {{project_phrase}}{{location}} — are you hoping to start soon? I can share options now.",
    urgent:
      "Hi {{lead_first_name}}, {{rep_intro}}. I got your message about {{project_phrase}}{{location}} — I can help today. When can we talk?",
    neutral:
      "Hi {{lead_first_name}}, {{rep_intro}}. Thanks for reaching out about {{project_phrase}}{{location}} — mind if I ask a couple of quick questions so I can help you faster?",
  },
  SOLAR: { exploring: "", soon: "", urgent: "", neutral: "" },
  CONSTRUCTION: { exploring: "", soon: "", urgent: "", neutral: "" },
  ROOFING: { exploring: "", soon: "", urgent: "", neutral: "" },
  ELECTRICAL: { exploring: "", soon: "", urgent: "", neutral: "" },
  LANDSCAPING: { exploring: "", soon: "", urgent: "", neutral: "" },
};

export function extractRepFirstName(repName: string | null | undefined): string {
  const trimmed = (repName ?? "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

export function buildRepIntro(repFirstName: string, companyName: string): string {
  const company = companyName.trim();
  if (repFirstName) {
    return company ? `this is ${repFirstName} from ${company}` : `this is ${repFirstName}`;
  }
  return company ? `this is the team at ${company}` : "this is our team";
}

export function nicheProjectPhrase(industry: string | null | undefined): string {
  const cat = mapIndustryToCategory(industry);
  if (cat === "GENERIC") return "your project";
  const label = NICHE_PROJECT_LABELS[cat];
  return label ? `your ${label} project` : "your project";
}

function compile(template: string, vars: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k: string) => {
    return vars[k] ?? "";
  });
}

export function extractCity(formData: Record<string, unknown> | null | undefined): string | null {
  const data = formData ?? {};
  for (const [key, value] of Object.entries(data)) {
    const k = key.toLowerCase();
    if (k.includes("city") || k.includes("suburb") || k.includes("town") || k.includes("location")) {
      const v = String(value ?? "").trim();
      if (v) return v;
    }
  }
  return null;
}

/**
 * Phase B: if form fields are tagged with role=location or role=urgency, use those values preferentially.
 * The incoming formData may include special keys like "__fields" carrying metadata (IDs to roles).
 */
export function extractPhaseBMetadata(formData: Record<string, unknown> | null | undefined): {
  city: string | null;
  tier: UrgencyTier | null;
} {
  const data = formData ?? {};
  const fieldsMeta = (data.__fields as Array<{ id: string; role?: string; label?: string }> | undefined) ?? undefined;
  let city: string | null = null;
  let tier: UrgencyTier | null = null;

  if (Array.isArray(fieldsMeta) && fieldsMeta.length) {
    for (const f of fieldsMeta) {
      if (!f || typeof f !== "object") continue;
      const role = typeof f.role === "string" ? f.role : undefined;
      const label = typeof f.label === "string" ? f.label : undefined;
      const key = label && data[label] !== undefined ? label : f.id;
      const value = typeof key === "string" ? (data[key] as unknown) : undefined;
      const strVal = String(value ?? "").trim();
      if (!strVal) continue;
      if (!city && role === "location") city = strVal;
      if (!tier && role === "urgency") {
        const v = strVal.toLowerCase();
        if (v.includes("urgent") || v.includes("immediate") || v.includes("asap")) tier = "urgent";
        else if (v.includes("soon") || v.includes("weeks") || v.includes("1-2")) tier = "soon";
        else if (v.includes("explor") || v.includes("planning") || v.includes("later")) tier = "exploring";
        else tier = "neutral";
      }
      if (city && tier) break;
    }
  }

  if (!city) city = extractCity(formData);
  return { city, tier };
}

export function normalizePhoneForWhatsApp(raw: string | null | undefined, clientDialCode?: string | null): string | null {
  const dial = (clientDialCode && clientDialCode.replace(/\D+/g, "")) || "263";
  if (!raw) return null;
  let digits = String(raw).replace(/\D+/g, "");
  if (!digits) return null;
  // a) already handled by strip
  // b) 00 prefix → strip 00 and treat as country-coded
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }
  // c) starts with known country codes → keep
  const known = ["263", "260", "27", "254"];
  if (known.some((k) => digits.startsWith(k))) {
    return digits;
  }
  // d) leading single 0 → replace with client dial code
  if (digits.startsWith("0")) {
    // collapse multiple leading zeros to single before replace, just in case
    digits = digits.replace(/^0+/, "0");
    return (dial + digits.slice(1)).replace(/^\+/, "");
  }
  // e) bare national, no 0, no cc → prepend client dial code
  if (/^\d{6,15}$/.test(digits)) {
    return (dial + digits).replace(/^\+/, "");
  }
  // invalid
  return null;
}

export function buildWhatsAppUrl(digits: string, message: string): string {
  const isMobile = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const msg = encodeURIComponent(message);
  if (isMobile) {
    return digits ? `whatsapp://send?phone=${digits}&text=${msg}` : `whatsapp://send?text=${msg}`;
  }
  return digits ? `https://wa.me/${digits}?text=${msg}` : `https://wa.me/?text=${msg}`;
}

export async function fetchClientWhatsAppMeta(clientId: string): Promise<{ name: string; industry: string; dial_code: string | null } | null> {
  try {
    const res = await fetch(`/api/clients/${clientId}/whatsapp-meta`);
    if (!res.ok) return null;
    const j = (await res.json()) as { name?: string; industry?: string; dial_code?: string | null };
    return { name: String(j.name ?? ""), industry: String(j.industry ?? ""), dial_code: j.dial_code ?? null };
  } catch {
    return null;
  }
}

export function buildOpenerMessage(opts: {
  leadFirstName: string;
  repName: string;
  companyName: string;
  industry: string | null;
  city: string | null;
  tier?: UrgencyTier;
}): string {
  const { leadFirstName, companyName, city } = opts;
  const cat = mapIndustryToCategory(opts.industry);
  const tier = opts.tier ?? "neutral";
  const candidate = TEMPLATES[cat]?.[tier];
  const base = (candidate && candidate.length > 0 ? candidate : TEMPLATES.GENERIC[tier]) as string;
  const location = city ? ` in ${city}` : "";
  const repFirstName = extractRepFirstName(opts.repName);
  const repIntro = buildRepIntro(repFirstName, companyName);
  const projectPhrase = nicheProjectPhrase(opts.industry);
  return compile(base, {
    lead_first_name: leadFirstName,
    rep_intro: repIntro,
    project_phrase: projectPhrase,
    location,
  });
}

export async function openWhatsAppAndLog({
  clientId,
  leadName,
  leadPhone,
  repName,
  formData,
  industry: industryIn,
  companyName: companyNameIn,
  dialCode: dialCodeIn,
  tier = "neutral",
}: {
  leadId: string;
  clientId: string;
  leadName: string | null | undefined;
  leadPhone: string | null | undefined;
  repName: string;
  formData?: Record<string, unknown> | null;
  industry?: string | null;
  companyName?: string | null;
  dialCode?: string | null;
  tier?: UrgencyTier;
}): Promise<void> {
  const meta = companyNameIn && industryIn ? { name: companyNameIn, industry: industryIn, dial_code: dialCodeIn ?? null } : await fetchClientWhatsAppMeta(clientId);
  const companyName = companyNameIn ?? meta?.name ?? "";
  const industry = industryIn ?? meta?.industry ?? null;
  const dialCode = dialCodeIn ?? meta?.dial_code ?? null;

  const first = (leadName || "there").split(/\s+/)[0] || "there";
  const metaB = extractPhaseBMetadata(formData ?? null);
  const effectiveTier = tier ?? metaB.tier ?? "neutral";
  const city = metaB.city;
  const message = buildOpenerMessage({ leadFirstName: first, repName, companyName, industry, city, tier: effectiveTier });
  const digits = normalizePhoneForWhatsApp(leadPhone, dialCode);

  if (!digits) return; // invalid — let caller render disabled if possible

  const url = buildWhatsAppUrl(digits, message);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    window.location.href = url;
  }
}
