import { parseMoney, parseQuantity } from "@/lib/commercial/money";

export type ImportRow = Record<string, string>;
export type ImportDecision = "CREATE" | "UPDATE" | "SKIP";

export type ValidatedImportRow = {
  rowNumber: number;
  raw: ImportRow;
  decision: ImportDecision;
  errors: string[];
  warnings: string[];
  sku: string | null;
  name: string;
  itemType: "PRODUCT" | "SERVICE";
  sellingPrice: number | null;
  costPrice: number | null;
  onHand: number | null;
  unit: string;
  allowFractional: boolean;
};

const REQUIRED = ["Product Name", "name", "SKU", "sku"];

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export function mapRow(raw: ImportRow, columnMap: Record<string, string>): ImportRow {
  const out: ImportRow = {};
  for (const [source, target] of Object.entries(columnMap)) {
    if (!target) continue;
    out[target] = raw[source] ?? raw[normalizeHeader(source)] ?? "";
  }
  return out;
}

export function validateImportRows(
  rows: ImportRow[],
  opts: {
    existingSkus: Map<string, { id: string }>;
    duplicateMode: ImportDecision;
    knownUnits?: Set<string>;
    currencies?: Set<string>;
  }
): ValidatedImportRow[] {
  const seen = new Set<string>();
  return rows.map((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = (raw.name || raw.product_name || "").trim();
    const sku = (raw.sku || "").trim() || null;
    const itemType = String(raw.product_type || raw.item_type || "product").toUpperCase() === "SERVICE" ? "SERVICE" : "PRODUCT";
    const unit = (raw.unit || "Each").trim() || "Each";
    const allowFractional = /metre|liter|litre|kg|kilogram|m²|roll|hour/i.test(unit);
    if (!name) errors.push("missing required fields: name");
    if (opts.knownUnits && opts.knownUnits.size && !opts.knownUnits.has(unit) && unit !== "Each") {
      warnings.push(`unknown unit: ${unit}`);
    }
    const selling = raw.selling_price || raw.price ? parseMoney(raw.selling_price || raw.price) : 0;
    if (raw.selling_price && selling == null) errors.push("invalid price");
    const cost = raw.cost_price ? parseMoney(raw.cost_price) : null;
    if (raw.cost_price && cost == null) errors.push("invalid price");
    let onHand: number | null = null;
    if (raw.on_hand || raw.quantity) {
      const q = parseQuantity(raw.on_hand || raw.quantity, allowFractional);
      if (!q.ok) errors.push(q.reason);
      else onHand = q.value;
    }
    const currency = (raw.currency || "").trim();
    if (currency && opts.currencies && opts.currencies.size && !opts.currencies.has(currency)) {
      errors.push("invalid currency");
    }
    let decision: ImportDecision = "CREATE";
    if (sku) {
      const key = sku.toLowerCase();
      if (seen.has(key)) errors.push("duplicate SKU");
      seen.add(key);
      if (opts.existingSkus.has(key)) {
        if (opts.duplicateMode === "SKIP") decision = "SKIP";
        else if (opts.duplicateMode === "UPDATE") decision = "UPDATE";
        else errors.push("duplicate SKU");
      }
    }
    return {
      rowNumber,
      raw,
      decision: errors.length ? "SKIP" : decision,
      errors,
      warnings,
      sku,
      name,
      itemType,
      sellingPrice: selling,
      costPrice: cost,
      onHand,
      unit,
      allowFractional,
    };
  });
}

export function importSummary(rows: ValidatedImportRow[]) {
  return {
    total: rows.length,
    ready: rows.filter((r) => r.errors.length === 0 && r.decision === "CREATE").length,
    updates: rows.filter((r) => r.errors.length === 0 && r.decision === "UPDATE").length,
    skipped: rows.filter((r) => r.decision === "SKIP" && r.errors.length === 0).length,
    warnings: rows.reduce((n, r) => n + r.warnings.length, 0),
    errors: rows.filter((r) => r.errors.length > 0).length,
  };
}

export function parseCsvText(text: string): { headers: string[]; rows: ImportRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: ImportRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
      row[normalizeHeader(h)] = values[i] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.replace(/^"|"$/g, "").trim());
}

void REQUIRED;
