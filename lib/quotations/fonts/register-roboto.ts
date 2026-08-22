import { existsSync } from "fs";
import path from "path";
import { Font } from "@react-pdf/renderer";

export const QUOTATION_FONT_FAMILY = "Roboto";

let registered = false;

function fontPath(file: string): string {
  return path.join(process.cwd(), "lib", "quotations", "fonts", "roboto", file);
}

/** Registers Roboto for quotation PDFs. Safe to call more than once. */
export function registerQuotationFonts(): void {
  if (registered) return;

  const regular = fontPath("Roboto-Regular.ttf");
  const medium = fontPath("Roboto-Medium.ttf");
  const bold = fontPath("Roboto-Bold.ttf");
  for (const src of [regular, medium, bold]) {
    if (!existsSync(src)) {
      throw new Error(`Quotation font missing: ${src}`);
    }
  }

  // Roboto (Apache License 2.0), hinted TTFs from googlefonts/roboto.
  Font.register({
    family: QUOTATION_FONT_FAMILY,
    fonts: [
      { src: regular, fontWeight: 400 },
      { src: medium, fontWeight: 500 },
      { src: bold, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
