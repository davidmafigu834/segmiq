import React from "react";
import { registerQuotationFonts } from "@/lib/quotations/fonts/register-roboto";
import { renderToBuffer } from "@react-pdf/renderer";
import { WeeklyTeamReportDocument } from "./pdf-document";
import { preparePayloadForPdf } from "./validate";
import type { WeeklyReportPayload } from "./types";

async function fetchLogoDataUri(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderWeeklyTeamReportPdf(payload: WeeklyReportPayload): Promise<Buffer> {
  registerQuotationFonts();
  const prepared = preparePayloadForPdf(payload);
  const logoDataUri = await fetchLogoDataUri(prepared.cover.organisationLogoUrl);
  const element = <WeeklyTeamReportDocument payload={prepared} logoDataUri={logoDataUri} />;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
