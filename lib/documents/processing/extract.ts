import type { ExtractionResult } from "@/lib/documents/processing/types";
import { DocumentExtractionError } from "@/lib/documents/processing/types";
import { SCANNED_TEXT_THRESHOLD } from "@/lib/documents/processing/constants";

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function resultFromPlain(plainText: string, pages?: { pageNumber: number; text: string }[]): ExtractionResult {
  const normalized = normalizeText(plainText);
  return {
    plainText: normalized,
    pages: pages ?? (normalized ? [{ pageNumber: 1, text: normalized }] : []),
    tables: [],
  };
}

export async function extractPlainText(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const text = normalizeText(buffer.toString("utf8"));
  if (!text) throw new DocumentExtractionError("EMPTY", "Text file is empty.");
  return resultFromPlain(text);
}

export async function extractCsv(buffer: Buffer): Promise<ExtractionResult> {
  const raw = normalizeText(buffer.toString("utf8"));
  if (!raw) throw new DocumentExtractionError("EMPTY", "CSV file is empty.");

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const rows = lines.map((line) => line.split(",").map((c) => c.trim()));
  const plainText = rows.map((r) => r.join(" | ")).join("\n");

  return {
    plainText,
    pages: [{ pageNumber: 1, text: plainText }],
    tables: [
      {
        id: "csv-1",
        label: "CSV data",
        pageNumber: 1,
        rows,
      },
    ],
  };
}

export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const pdfParse = (await import("pdf-parse")).default as (
      data: Buffer
    ) => Promise<{ text: string; numpages: number }>;
    const parsed = await pdfParse(buffer);
    const fullText = normalizeText(parsed.text ?? "");

    if (!fullText) {
      return {
        plainText: "",
        pages: [],
        tables: [],
        likelyScanned: true,
      };
    }

    if (fullText.length < SCANNED_TEXT_THRESHOLD) {
      return {
        plainText: fullText,
        pages: [{ pageNumber: 1, text: fullText }],
        tables: [],
        likelyScanned: true,
      };
    }

    const pages: { pageNumber: number; text: string }[] = [];
    const pageChunks = fullText.split(/\f/g);
    if (pageChunks.length > 1) {
      pageChunks.forEach((chunk, i) => {
        const text = normalizeText(chunk);
        if (text) pages.push({ pageNumber: i + 1, text });
      });
    } else {
      pages.push({ pageNumber: 1, text: fullText });
    }

    return {
      plainText: fullText,
      pages,
      tables: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/password|encrypted/i.test(message)) {
      throw new DocumentExtractionError(
        "PASSWORD_PROTECTED",
        "This PDF is password protected and cannot be analyzed."
      );
    }
    throw new DocumentExtractionError("CORRUPT", `Could not read PDF: ${message}`);
  }
}

export async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    const plainText = normalizeText(value);
    if (!plainText) throw new DocumentExtractionError("EMPTY", "DOCX contains no extractable text.");
    return resultFromPlain(plainText);
  } catch (err) {
    if (err instanceof DocumentExtractionError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new DocumentExtractionError("CORRUPT", `Could not read DOCX: ${message}`);
  }
}

export async function extractXlsx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const tables: ExtractionResult["tables"] = [];
    const pageTexts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" }) as string[][];
      const normalizedRows = rows.map((row) =>
        row.map((cell) => (cell == null ? "" : String(cell).trim()))
      );
      const nonEmpty = normalizedRows.filter((row) => row.some((c) => c.length > 0));
      if (!nonEmpty.length) continue;

      tables.push({
        id: `sheet-${sheetName}`,
        label: sheetName,
        rows: nonEmpty,
      });

      const sheetText = nonEmpty.map((r) => r.join(" | ")).join("\n");
      pageTexts.push(`[${sheetName}]\n${sheetText}`);
    }

    const plainText = normalizeText(pageTexts.join("\n\n"));
    if (!plainText) throw new DocumentExtractionError("EMPTY", "Spreadsheet contains no data.");

    return {
      plainText,
      pages: [{ pageNumber: 1, text: plainText }],
      tables,
    };
  } catch (err) {
    if (err instanceof DocumentExtractionError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new DocumentExtractionError("CORRUPT", `Could not read spreadsheet: ${message}`);
  }
}

export async function extractImage(buffer: Buffer): Promise<ExtractionResult> {
  void buffer;
  return {
    plainText: "",
    pages: [],
    tables: [],
    likelyScanned: true,
    skipped: true,
    skipReason: "Image OCR is not enabled in this release. Original file is stored securely.",
  };
}

export async function extractByMime(buffer: Buffer, mimeType: string, filename: string): Promise<ExtractionResult> {
  const mime = mimeType.toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (mime === "text/plain" || ext === "txt") return extractPlainText(buffer, mime);
  if (mime === "text/csv" || ext === "csv") return extractCsv(buffer);
  if (mime === "application/pdf" || ext === "pdf") return extractPdf(buffer);
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return extractDocx(buffer);
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    ext === "xlsx" ||
    ext === "xls"
  ) {
    return extractXlsx(buffer);
  }
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png"].includes(ext)) {
    return extractImage(buffer);
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    return {
      plainText: "",
      pages: [],
      tables: [],
      skipped: true,
      skipReason: "PPTX slide text extraction is not yet supported. Original file is stored securely.",
    };
  }

  throw new DocumentExtractionError("UNSUPPORTED", `Unsupported file type: ${mime || ext}`);
}

export function summarizeExtraction(result: ExtractionResult): { charCount: number; wordCount: number } {
  const charCount = result.plainText.length;
  return { charCount, wordCount: countWords(result.plainText) };
}
