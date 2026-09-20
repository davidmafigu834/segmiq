/**
 * Server-side minimisation for platform diagnostics.
 *
 * Diagnostics should prefer identifiers over content. When an identifying
 * reference genuinely helps an operator, it is masked HERE — on the server —
 * so the unmasked value never reaches the browser.
 */

/** `+263771234821` → `+263 77***4821` */
export function maskPhone(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  const head = digits.slice(0, plus ? 5 : 3);
  const tail = digits.slice(-4);
  const prefix = plus ? `+${head.slice(0, 3)} ${head.slice(3)}` : head;
  return `${prefix}***${tail}`;
}

/** `tawanda@company.co.zw` → `ta***@company.co.zw` */
export function maskEmail(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const at = raw.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

/** `Tawanda Mutasa` → `Ta**** M****` */
export function maskPersonName(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  return (
    raw
      .split(/\s+/)
      .slice(0, 3)
      .map((part) => {
        if (part.length <= 1) return `${part}*`;
        const keep = part.length > 3 ? 2 : 1;
        return `${part.slice(0, keep)}${"*".repeat(Math.min(4, part.length - keep))}`;
      })
      .join(" ") || "***"
  );
}

/**
 * Free-text customer content (message bodies, notes, document text) is never
 * surfaced in diagnostics. Only its shape is reported.
 */
export function describeContent(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  return `${raw.length} characters (content withheld)`;
}

/** `Conversation #8392` style operator reference derived from an id. */
export function resourceRef(
  resourceType: string,
  resourceId: string | null | undefined
): string {
  const label = resourceType
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const id = (resourceId ?? "").trim();
  if (!id) return label;
  const short = id.includes("-") ? id.split("-")[0] : id.slice(0, 8);
  return `${label} #${short}`;
}

export type MaskedContactRef = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  masked: true;
};

/**
 * Build the only customer-identifying payload a normal platform admin may see.
 * Callers must pass raw values; the masked result is what gets serialised.
 */
export function maskedContactRef(row: {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): MaskedContactRef {
  return {
    id: row.id,
    name: maskPersonName(row.name),
    phone: maskPhone(row.phone),
    email: maskEmail(row.email),
    masked: true,
  };
}

const CONTENT_KEY_RE =
  /(body|message|content|text|note|notes|summary|transcript|prompt|caption|address|phone|email|name|payload|snippet)/i;

/**
 * Strip customer content and identifiers from an audit/diagnostic metadata bag.
 * Identifier-shaped keys (`*Id`, `*Count`, codes, statuses) are preserved.
 */
export function stripCustomerContent(
  meta: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/Id$|_id$|^id$/i.test(key)) {
      out[key] = value;
      continue;
    }
    if (CONTENT_KEY_RE.test(key)) continue;
    if (typeof value === "string" && value.length > 200) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = stripCustomerContent(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}
