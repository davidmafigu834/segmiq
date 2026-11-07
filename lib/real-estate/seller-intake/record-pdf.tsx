import React from "react";
import { Document, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { QUOTATION_FONT_FAMILY, registerQuotationFonts } from "@/lib/quotations/fonts/register-roboto";
import type { SellerRecord, SellerRecordSection } from "@/lib/real-estate/seller-intake/record";

const INK = "#1C1917";
const MUTED = "#57534E";
const LINE = "#E7E5E4";
const PAPER = "#FFFFFF";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontFamily: QUOTATION_FONT_FAMILY,
    fontSize: 10,
    color: INK,
    backgroundColor: PAPER,
  },
  bar: { position: "absolute", top: 0, left: 0, right: 0, height: 6 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  logo: { width: 42, height: 42, objectFit: "contain", marginRight: 10 },
  agency: { fontSize: 12, fontWeight: 700 },
  kicker: { marginTop: 2, fontSize: 8, letterSpacing: 0.6, textTransform: "uppercase", color: MUTED },
  contact: { marginTop: 2, fontSize: 8, color: MUTED },
  kind: { fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", color: MUTED },
  seller: { marginTop: 4, fontSize: 20, fontWeight: 700, lineHeight: 1.2 },
  address: { marginTop: 3, fontSize: 11, lineHeight: 1.35, color: "#292524" },
  meta: { marginTop: 6, fontSize: 9, color: MUTED },
  section: { marginTop: 16 },
  sectionTitle: {
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: MUTED,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F5F5F4",
  },
  label: { width: 190, paddingRight: 12, fontSize: 9, lineHeight: 1.35, color: MUTED },
  value: { flex: 1, fontSize: 10.5, lineHeight: 1.4, fontWeight: 500 },
  note: { marginTop: 16, fontSize: 8.5, lineHeight: 1.4, color: MUTED },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
  },
});

function SectionBlock({ section }: { section: SellerRecordSection }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.rows.map((row) => (
        <View key={row.key} style={styles.row} wrap={false}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function SellerRecordDocument({ record, logoDataUri }: { record: SellerRecord; logoDataUri: string | null }) {
  const contact = [record.phone, record.website].filter(Boolean).join("  ·  ");
  const meta = [record.kindLabel, record.submittedLabel ? `Submitted ${record.submittedLabel}` : null].filter(Boolean).join("  ·  ");
  return (
    <Document title={`${record.sellerName} · ${record.kindLabel}`} author={record.agencyName}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.bar, { backgroundColor: record.brandColor }]} fixed />
        <View style={styles.brandRow}>
          {logoDataUri ? (
            // react-pdf Image is not an HTML image. The agency name is beside it.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.logo} src={logoDataUri} />
          ) : (
            <View style={{ width: 8, height: 28, marginRight: 10, backgroundColor: record.brandColor }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.agency}>{record.agencyName}</Text>
            <Text style={styles.kicker}>Mandate record</Text>
            {contact ? <Text style={styles.contact}>{contact}</Text> : null}
          </View>
        </View>
        <Text style={styles.kind}>{meta}</Text>
        <Text style={styles.seller}>{record.sellerName}</Text>
        {record.propertyAddress ? <Text style={styles.address}>{record.propertyAddress}</Text> : null}
        {record.templateTitle ? <Text style={styles.meta}>{record.templateTitle}</Text> : null}
        {record.sections.length === 0 ? (
          <Text style={styles.note}>The seller has not submitted any answers on this form yet.</Text>
        ) : (
          record.sections.map((section) => <SectionBlock key={section.id} section={section} />)
        )}
        {record.restrictedNote ? <Text style={styles.note}>{record.restrictedNote}</Text> : null}
        <View style={styles.footer} fixed>
          <Text>{record.agencyName} · Answers submitted on the mandate form</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

async function fetchLogoDataUri(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 3_000_000) return null;
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderSellerRecordPdf(record: SellerRecord): Promise<Buffer> {
  registerQuotationFonts();
  const logoDataUri = await fetchLogoDataUri(record.logoUrl);
  const buffer = await renderToBuffer(<SellerRecordDocument record={record} logoDataUri={logoDataUri} />);
  return Buffer.from(buffer);
}
