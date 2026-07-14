import type { WhatsAppQualQuestion } from "@/lib/whatsapp/qualification-questions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidActorUuid(id: string | null | undefined): id is string {
  return Boolean(id && UUID_RE.test(id));
}

export function normalizeBudgetAnswer(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^\d+([.,]\d+)?$/.test(trimmed)) return trimmed.replace(",", ".");
  const match = trimmed.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (match) return match[1].replace(/,/g, "");
  return trimmed;
}

export function normalizeQualificationAnswer(
  question: WhatsAppQualQuestion,
  raw: string
): string {
  const text = raw.trim();
  if (!text) return text;

  if (question.options?.length) {
    const asNumber = Number.parseInt(text, 10);
    if (
      !Number.isNaN(asNumber) &&
      asNumber >= 1 &&
      asNumber <= question.options.length &&
      String(asNumber) === text.replace(/\s/g, "")
    ) {
      return question.options[asNumber - 1];
    }
    const exact = question.options.find((o) => o.toLowerCase() === text.toLowerCase());
    if (exact) return exact;
  }

  if (String(question.maps_to).toLowerCase() === "budget") {
    return normalizeBudgetAnswer(text);
  }

  return text;
}
