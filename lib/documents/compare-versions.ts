export type DocumentVersionDiffRow = {
  field: string;
  from: string;
  to: string;
};

function normalizeLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd());
}

/**
 * Line-level text comparison between two document versions.
 * Unchanged lines are omitted; adjacent changes are grouped.
 */
export function compareDocumentVersionText(
  fromText: string,
  toText: string,
  opts?: { fromLabel?: string; toLabel?: string }
): DocumentVersionDiffRow[] {
  const fromLines = normalizeLines(fromText || "");
  const toLines = normalizeLines(toText || "");
  const fromLabel = opts?.fromLabel ?? "Earlier version";
  const toLabel = opts?.toLabel ?? "Later version";

  const rows: DocumentVersionDiffRow[] = [];

  const maxLen = Math.max(fromLines.length, toLines.length);
  let i = 0;
  while (i < maxLen) {
    const fromLine = fromLines[i] ?? "";
    const toLine = toLines[i] ?? "";

    if (fromLine === toLine) {
      i += 1;
      continue;
    }

    const lineNum = i + 1;
    if (!fromLine && toLine) {
      rows.push({ field: `Line ${lineNum} added`, from: "—", to: truncate(toLine) });
    } else if (fromLine && !toLine) {
      rows.push({ field: `Line ${lineNum} removed`, from: truncate(fromLine), to: "—" });
    } else {
      rows.push({ field: `Line ${lineNum}`, from: truncate(fromLine), to: truncate(toLine) });
    }
    i += 1;
  }

  if (!rows.length && fromText.trim() !== toText.trim()) {
    rows.push({
      field: "Document text",
      from: truncate(fromText, 120),
      to: truncate(toText, 120),
    });
  }

  if (!rows.length) return rows;

  if (fromLines.length !== toLines.length) {
    rows.push({
      field: "Line count",
      from: String(fromLines.length),
      to: String(toLines.length),
    });
  }

  return rows.slice(0, 80);
}

function truncate(value: string, max = 200): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed || "—";
  return `${trimmed.slice(0, max - 1)}…`;
}
