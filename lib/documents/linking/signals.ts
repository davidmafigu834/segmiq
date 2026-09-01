import { normalizeLabel, overlapScore } from "@/lib/documents/classification/matching";

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function phonesLikelyMatch(a: string, b: string): boolean {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right) return false;
  const minLen = Math.min(left.length, right.length);
  if (minLen < 7) return false;
  return left.slice(-minLen) === right.slice(-minLen);
}

export function emailsMatch(a: string, b: string): boolean {
  return normalizeLabel(a) === normalizeLabel(b);
}

export function namesLikelyMatch(query: string, candidate: string): number {
  return overlapScore(query, candidate);
}

export function extractQuoteNumbers(text: string): string[] {
  const matches = text.match(/\bQ[-\s]?\d{3,8}\b/gi) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\s/g, "").toUpperCase()))];
}

export function extractEmails(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

export function extractPhoneCandidates(text: string): string[] {
  const matches = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) ?? [];
  return [...new Set(matches.map((m) => normalizePhoneDigits(m)).filter((d) => d.length >= 9))];
}

export function normalizeQuoteNumber(value: string): string {
  return value.replace(/\s/g, "").replace(/^Q/i, "Q").toUpperCase();
}

export function quoteNumbersEquivalent(a: string, b: string): boolean {
  const left = normalizeQuoteNumber(a).replace(/[^A-Z0-9]/g, "");
  const right = normalizeQuoteNumber(b).replace(/[^A-Z0-9]/g, "");
  return left === right;
}
