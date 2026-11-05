import { createHash } from "node:crypto";
import { fieldsForKind } from "@/lib/real-estate/seller-intake/fields";
import { exclusivityNote } from "@/lib/real-estate/seller-intake/fields";
import type { IntakeSnapshot } from "@/lib/real-estate/seller-intake/review-plan";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const FONT_SIZE = 11;
const LEADING = 15;
const MAX_CHARS = 72;

export function wrapText(value: string, width = MAX_CHARS): string[] {
  const paragraphs = value.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      if (word.length > width) {
        if (current) lines.push(current);
        for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
        current = "";
        continue;
      }
      const next = current ? `${current} ${word}` : word;
      if (next.length > width) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function pdfLiteral(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === "(") out += "\\(";
    else if (ch === ")") out += "\\)";
    else if (code >= 32 && code <= 126) out += ch;
    else if (code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += "?";
  }
  return `(${out})`;
}

function pageStream(lines: string[]): string {
  const commands = ["BT", `/F1 ${FONT_SIZE} Tf`, `${LEADING} TL`, `${MARGIN} ${PAGE_HEIGHT - MARGIN} Td`];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("T*");
    commands.push(`${pdfLiteral(line)} Tj`);
  });
  commands.push("ET");
  return commands.join("\n");
}

function buildPdf(pages: string[][]): Buffer {
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 3;
  const fontId = 3;
  nextId = 4;
  for (const lines of pages) {
    const content = pageStream(lines);
    const contentId = nextId++;
    const pageId = nextId++;
    objects[contentId] = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    pageIds.push(pageId);
  }
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < nextId; id++) {
    offsets[id] = Buffer.byteLength(pdf);
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${nextId}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id < nextId; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

const SIGNING_LINES = [
  "",
  "Signing block. Nothing in this block has been signed.",
  "Signature of owner or representative: ____________________",
  "Witness: ____________________",
  "Sales negotiator signature: ____________________",
  "Place: ____________________",
  "Signature date: not recorded",
];

export function layoutMandatePages(snapshot: IntakeSnapshot, options?: { includeRestricted?: boolean }): string[][] {
  const includeRestricted = options?.includeRestricted !== false;
  const organisation = snapshot.organisationName?.trim() || "Organisation name is not on this template version";
  const lines: string[] = [
    snapshot.title,
    snapshot.kind === "sole" ? "Sole mandate" : "Open mandate",
    "Prepared for signature. This copy is not signed.",
    "",
  ];
  let omittedRestricted = false;
  for (const field of fieldsForKind(snapshot.kind)) {
    const value = snapshot.answers[field.key]?.trim();
    if (!value) continue;
    if (field.restricted && !includeRestricted) {
      omittedRestricted = true;
      continue;
    }
    lines.push(...wrapText(`${field.label}: ${value}`));
  }
  if (omittedRestricted) {
    lines.push("");
    lines.push("Identity, spouse, employer, PEP and source-of-funds answers are omitted from this copy.");
  }
  const exclusivity = exclusivityNote({
    kind: snapshot.kind,
    minimumMonths: snapshot.exclusivityMinimumMonths,
    continuesUntilVaried: snapshot.exclusivityContinuesUntilVaried,
  });
  if (exclusivity) {
    lines.push("");
    lines.push(...wrapText(exclusivity));
  }
  if (snapshot.clauses.length) {
    lines.push("");
    lines.push("Template clauses for this version");
    for (const clause of snapshot.clauses) lines.push(...wrapText(clause));
  } else {
    lines.push("");
    lines.push("This template version has no clause text.");
  }
  lines.push(`Submission snapshot: ${snapshot.submittedAt}`);
  const headerRoom = 2;
  const capacity = Math.floor((PAGE_HEIGHT - MARGIN * 2) / LEADING) - headerRoom;
  const bodyPages: string[][] = [];
  for (let index = 0; index < lines.length; index += capacity) bodyPages.push(lines.slice(index, index + capacity));
  const last = bodyPages[bodyPages.length - 1] ?? [];
  if (last.length + SIGNING_LINES.length > capacity) bodyPages.push([]);
  bodyPages[bodyPages.length - 1]?.push(...SIGNING_LINES);
  const total = bodyPages.length || 1;
  return bodyPages.map((page, index) => [
    index === 0 ? organisation : `${organisation} (continued)`,
    `Page ${index + 1} of ${total}`,
    ...page,
  ]);
}

export function renderMandatePdf(snapshot: IntakeSnapshot, options?: { includeRestricted?: boolean }): { bytes: Buffer; sha256: string; pageCount: number; pages: string[][] } {
  const pages = layoutMandatePages(snapshot, options);
  const bytes = buildPdf(pages.length ? pages : [[""]]);
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), pageCount: pages.length || 1, pages };
}
