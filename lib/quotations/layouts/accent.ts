import { TEMPLATE_LIME } from "./types";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function luminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const chan = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

function contrast(a: string, b: string): number | null {
  const l1 = luminance(a);
  const l2 = luminance(b);
  if (l1 == null || l2 == null) return null;
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Company accent only if it stays readable on white and dark text. */
export function resolveDocumentAccent(companyColor: string | null | undefined, templateAccent: string): string {
  const candidate = (companyColor || "").trim();
  if (!candidate.startsWith("#") || candidate.length !== 7) return templateAccent || TEMPLATE_LIME;
  const vsWhite = contrast(candidate, "#FFFFFF");
  const vsInk = contrast(candidate, "#1A1A1A");
  if (vsWhite != null && vsWhite >= 2.2 && vsInk != null && vsInk >= 2.0) return candidate;
  return templateAccent || TEMPLATE_LIME;
}
