import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatMoney } from "@/lib/quotations/totals";
import type { QuoteDocumentModel } from "./types";
import { TEMPLATE_CHARCOAL, TEMPLATE_INK, TEMPLATE_LINE, TEMPLATE_MUTED } from "./types";
import { isSvgSrc } from "./resolve-image";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 9,
    color: TEMPLATE_INK,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", minHeight: 72 },
  logo: { width: 92, height: 28, objectFit: "contain" },
  companyName: { fontSize: 16, fontWeight: 700, letterSpacing: -0.2 },
  tagline: { fontSize: 7.5, color: TEMPLATE_MUTED, marginTop: 3 },
  headerRight: { alignItems: "flex-end", maxWidth: 210 },
  badge: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.8,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginBottom: 6,
  },
  quoteTitle: { fontSize: 22, fontWeight: 700, letterSpacing: 0.4 },
  metaRow: { flexDirection: "row", marginTop: 3 },
  metaLabel: { fontSize: 7, color: TEMPLATE_MUTED, width: 62, textAlign: "right", marginRight: 6 },
  metaValue: { fontSize: 8, fontWeight: 700, width: 88, textAlign: "right" },
  hero: { marginTop: 12, height: 138, overflow: "hidden", position: "relative" },
  heroImg: { width: "100%", height: 138, objectFit: "cover" },
  heroFallback: { width: "100%", height: 138, backgroundColor: "#2B2B2B" },
  heroOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "58%",
    paddingVertical: 22,
    paddingHorizontal: 18,
    justifyContent: "center",
    backgroundColor: "rgba(10,10,10,0.62)",
  },
  heroHeadline: { fontSize: 18, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2 },
  heroSub: { marginTop: 8, fontSize: 8, color: "#E8E8E8", lineHeight: 1.4, maxWidth: 240 },
  cards: { flexDirection: "row", marginTop: 10, gap: 8 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: TEMPLATE_LINE,
    borderRadius: 5,
    padding: 8,
    minHeight: 78,
  },
  cardLabel: { fontSize: 7, fontWeight: 700, letterSpacing: 0.7, color: TEMPLATE_MUTED, marginBottom: 5 },
  cardLine: { fontSize: 8, marginTop: 2, lineHeight: 1.35 },
  cardMuted: { fontSize: 7.5, color: TEMPLATE_MUTED, marginTop: 1 },
  kpi: {
    marginTop: 10,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: TEMPLATE_LINE,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  kpiCell: { flex: 1, paddingHorizontal: 8 },
  kpiLabel: { fontSize: 7, fontWeight: 700, letterSpacing: 0.6, marginBottom: 3 },
  kpiValue: { fontSize: 11, fontWeight: 700 },
  kpiSub: { fontSize: 7, color: TEMPLATE_MUTED, marginTop: 2 },
  tableWrap: { marginTop: 12 },
  tableBanner: { backgroundColor: TEMPLATE_CHARCOAL, paddingVertical: 7, paddingHorizontal: 8 },
  tableBannerText: { color: "#FFFFFF", fontSize: 8.5, fontWeight: 700, letterSpacing: 0.8 },
  tableHead: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.75, borderBottomColor: TEMPLATE_LINE },
  th: { fontSize: 7, color: TEMPLATE_MUTED, fontWeight: 700, letterSpacing: 0.4 },
  tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: TEMPLATE_LINE },
  cNum: { width: "6%" },
  cDesc: { width: "34%", paddingRight: 4 },
  cBrand: { width: "18%", paddingRight: 4 },
  cQty: { width: "8%", textAlign: "right" },
  cUnit: { width: "8%", textAlign: "right" },
  cPrice: { width: "13%", textAlign: "right" },
  cAmt: { width: "13%", textAlign: "right" },
  itemName: { fontSize: 8, fontWeight: 700 },
  itemDesc: { fontSize: 7.5, color: TEMPLATE_MUTED },
  sectionBar: { backgroundColor: "#F6F6F6", paddingVertical: 4, paddingHorizontal: 6 },
  lower: { flexDirection: "row", marginTop: 12, gap: 8 },
  lowerCol: { flex: 1, borderWidth: 1, borderColor: TEMPLATE_LINE, borderRadius: 5, padding: 8 },
  totalBox: {
    flex: 1.15,
    borderWidth: 1.5,
    borderRadius: 5,
    padding: 10,
    justifyContent: "center",
  },
  totalLabel: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: TEMPLATE_MUTED },
  totalValue: { fontSize: 16, fontWeight: 700, marginTop: 4 },
  totalWords: { fontSize: 7, color: TEMPLATE_MUTED, marginTop: 4, lineHeight: 1.3 },
  signRow: { flexDirection: "row", marginTop: 14, gap: 16 },
  signCol: { flex: 1 },
  signLine: { marginTop: 22, borderBottomWidth: 0.75, borderBottomColor: TEMPLATE_LINE },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: TEMPLATE_LINE,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: TEMPLATE_MUTED },
  continued: {
    position: "absolute",
    top: 16,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Headline({ text, accentWord, accent }: { text: string; accentWord: string | null; accent: string }) {
  if (!accentWord || !text.toLowerCase().includes(accentWord.toLowerCase())) {
    return <Text style={styles.heroHeadline}>{text}</Text>;
  }
  const idx = text.toLowerCase().indexOf(accentWord.toLowerCase());
  const before = text.slice(0, idx);
  const mid = text.slice(idx, idx + accentWord.length);
  const after = text.slice(idx + accentWord.length);
  return (
    <Text style={styles.heroHeadline}>
      {before}
      <Text style={{ color: accent }}>{mid}</Text>
      {after}
    </Text>
  );
}

function ResidentialPremiumSolarDocument({ model }: { model: QuoteDocumentModel }) {
  const accent = model.accent;
  const currency = model.quote.currency;
  let running = 0;

  return (
    <Document title={`Quotation ${model.quote.number}`} author={model.company.name}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.continued} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber }) =>
              pageNumber > 1 ? `${model.company.name}  ·  ${model.quote.number}` : ""
            }
          />
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => (pageNumber > 1 ? `Page ${pageNumber} of ${totalPages}` : "")}
          />
        </View>
        <View style={styles.header}>
          <View>
            {model.company.logoDataUri ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={styles.logo} src={model.company.logoDataUri} />
            ) : (
              <Text style={styles.companyName}>{model.company.name}</Text>
            )}
            {model.company.tagline ? <Text style={styles.tagline}>{model.company.tagline}</Text> : null}
            {model.company.logoDataUri ? <Text style={[styles.tagline, { marginTop: 4 }]}>{model.company.name}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            {model.badge ? (
              <Text style={[styles.badge, { backgroundColor: accent, color: TEMPLATE_INK }]}>{model.badge}</Text>
            ) : null}
            <Text style={styles.quoteTitle}>QUOTATION</Text>
            <View style={{ marginTop: 4 }}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Quotation No.</Text>
                <Text style={styles.metaValue}>{model.quote.number}</Text>
              </View>
              {model.quote.version > 1 ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Version</Text>
                  <Text style={styles.metaValue}>{model.quote.version}</Text>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>{formatDate(model.quote.issuedAt)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Valid Until</Text>
                <Text style={styles.metaValue}>{formatDate(model.quote.validUntil)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.hero} wrap={false}>
          {model.hero.imageSrc && !isSvgSrc(model.hero.imageSrc) ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.heroImg} src={model.hero.imageSrc} />
          ) : (
            <View style={styles.heroFallback} />
          )}
          <View style={styles.heroOverlay}>
            <Headline text={model.hero.headline} accentWord={model.hero.accentWord} accent={accent} />
            {model.hero.subcopy ? <Text style={styles.heroSub}>{model.hero.subcopy}</Text> : null}
          </View>
        </View>

        <View style={styles.cards} wrap={false}>
          {model.customer.name || model.customer.phone || model.customer.email || model.customer.address ? (
          <View style={styles.card}>
            <Text style={[styles.cardLabel, { color: accent }]}>CUSTOMER INFORMATION</Text>
            {model.customer.name ? <Text style={styles.cardLine}>{model.customer.name}</Text> : null}
            {model.customer.phone ? <Text style={styles.cardMuted}>{model.customer.phone}</Text> : null}
            {model.customer.email ? <Text style={styles.cardMuted}>{model.customer.email}</Text> : null}
            {model.customer.address ? <Text style={styles.cardMuted}>{model.customer.address}</Text> : null}
          </View>
          ) : null}
          {model.site.length > 0 ? (
            <View style={styles.card}>
              <Text style={[styles.cardLabel, { color: accent }]}>SITE / PROPERTY INFORMATION</Text>
              {model.site.map((row) => (
                <Text key={row.label} style={styles.cardMuted}>
                  {row.label}: {row.value}
                </Text>
              ))}
            </View>
          ) : null}
          {model.projectSummary ? (
            <View style={styles.card}>
              <Text style={[styles.cardLabel, { color: accent }]}>PROJECT SUMMARY</Text>
              <Text style={styles.cardLine}>{model.projectSummary}</Text>
            </View>
          ) : null}
        </View>

        {model.metrics.length > 0 ? (
          <View style={styles.kpi} wrap={false}>
            {model.metrics.map((m) => (
              <View key={m.id} style={styles.kpiCell}>
                <Text style={[styles.kpiLabel, { color: accent }]}>{m.label.toUpperCase()}</Text>
                <Text style={styles.kpiValue}>{m.value}</Text>
                {m.secondary ? <Text style={styles.kpiSub}>{m.secondary}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.tableWrap}>
          <View style={styles.tableBanner}>
            <Text style={styles.tableBannerText}>EQUIPMENT & SCOPE OF SUPPLY</Text>
          </View>
          <View style={styles.tableHead} wrap={false}>
            <Text style={[styles.th, styles.cNum]}>#</Text>
            <Text style={[styles.th, styles.cDesc]}>Description</Text>
            <Text style={[styles.th, styles.cBrand]}>Brand / Model</Text>
            <Text style={[styles.th, styles.cQty]}>Qty</Text>
            <Text style={[styles.th, styles.cUnit]}>Unit</Text>
            <Text style={[styles.th, styles.cPrice]}>Unit Price</Text>
            <Text style={[styles.th, styles.cAmt]}>Amount</Text>
          </View>
          {model.sections.map((section) => (
            <View key={section.title || "main"} wrap>
              {section.title ? (
                <View style={styles.sectionBar} wrap={false}>
                  <Text style={styles.itemName}>{section.title}</Text>
                </View>
              ) : null}
              {section.items.map((it) => {
                running += 1;
                return (
                  <View key={`${section.title}-${it.index}`} style={styles.tr} wrap={false}>
                    <Text style={[styles.cNum, styles.itemDesc]}>{running}</Text>
                    <View style={styles.cDesc}>
                      <Text style={styles.itemName}>{it.name}</Text>
                      {it.description ? <Text style={styles.itemDesc}>{it.description}</Text> : null}
                    </View>
                    <Text style={[styles.cBrand, styles.itemDesc]}>{it.brandModel || ""}</Text>
                    <Text style={[styles.cQty, styles.itemName]}>{it.quantity}</Text>
                    <Text style={[styles.cUnit, styles.itemDesc]}>{it.unit}</Text>
                    <Text style={[styles.cPrice, styles.itemDesc]}>{formatMoney(it.unitPrice, currency)}</Text>
                    <Text style={[styles.cAmt, styles.itemName]}>{formatMoney(it.amount, currency)}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {model.optionalItems.length > 0 ? (
          <View style={styles.tableWrap} wrap={false}>
            <View style={styles.sectionBar}>
              <Text style={styles.itemName}>OPTIONAL UPGRADES</Text>
            </View>
            {model.optionalItems.map((it) => (
              <View key={`opt-${it.index}`} style={styles.tr} wrap={false}>
                <Text style={[styles.cNum, styles.itemDesc]}>+</Text>
                <View style={styles.cDesc}>
                  <Text style={styles.itemName}>{it.name}</Text>
                </View>
                <Text style={[styles.cBrand, styles.itemDesc]}>{it.brandModel || ""}</Text>
                <Text style={[styles.cQty, styles.itemName]}>{it.quantity}</Text>
                <Text style={[styles.cUnit, styles.itemDesc]}>{it.unit}</Text>
                <Text style={[styles.cPrice, styles.itemDesc]}>{formatMoney(it.unitPrice, currency)}</Text>
                <Text style={[styles.cAmt, styles.itemName]}>{formatMoney(it.amount, currency)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.lower} wrap={false}>
          {model.paymentTerms.length > 0 ? (
            <View style={styles.lowerCol}>
              <Text style={[styles.cardLabel, { color: accent }]}>PAYMENT TERMS</Text>
              {model.paymentTerms.map((p) => (
                <Text key={p.label} style={styles.cardMuted}>
                  {p.label}
                  {p.detail ? ` — ${p.detail}` : ""}
                </Text>
              ))}
            </View>
          ) : null}
          {model.warranty.length > 0 ? (
            <View style={styles.lowerCol}>
              <Text style={[styles.cardLabel, { color: accent }]}>WARRANTY</Text>
              {model.warranty.map((w) => (
                <Text key={w.label} style={styles.cardMuted}>
                  {w.label}: {w.detail}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={styles.lowerCol}>
            <Text style={[styles.cardLabel, { color: accent }]}>COMMERCIAL SUMMARY</Text>
            <Text style={styles.cardMuted}>Subtotal {formatMoney(model.commercial.subtotal, currency)}</Text>
            {model.commercial.discountTotal > 0 ? (
              <Text style={styles.cardMuted}>Discount {formatMoney(model.commercial.discountTotal, currency)}</Text>
            ) : null}
            {model.commercial.taxRate > 0 || model.commercial.taxAmount > 0 ? (
              <Text style={styles.cardMuted}>
                Tax{model.commercial.taxRate ? ` (${model.commercial.taxRate}%)` : ""}{" "}
                {formatMoney(model.commercial.taxAmount, currency)}
              </Text>
            ) : null}
          </View>
          <View style={[styles.totalBox, { borderColor: accent }]}>
            <Text style={styles.totalLabel}>TOTAL AMOUNT ({currency})</Text>
            <Text
              style={[
                styles.totalValue,
                { color: accent, fontSize: String(Math.round(model.commercial.total)).length > 8 ? 12 : 16 },
              ]}
            >
              {formatMoney(model.commercial.total, currency)}
            </Text>
            {model.commercial.amountInWords ? (
              <Text style={styles.totalWords}>{model.commercial.amountInWords}</Text>
            ) : null}
          </View>
        </View>

        {model.showAcceptance ? (
          <View style={styles.signRow} wrap={false}>
            <View style={styles.signCol}>
              <Text style={[styles.cardLabel, { color: accent }]}>ACCEPTED BY</Text>
              <View style={styles.signLine} />
              <Text style={styles.cardMuted}>Name / Designation / Date / Signature</Text>
            </View>
            <View style={styles.signCol}>
              <Text style={[styles.cardLabel, { color: accent }]}>AUTHORISED SIGNATORY</Text>
              {model.company.signatureDataUri ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={model.company.signatureDataUri} style={{ width: 90, height: 28, marginTop: 8, objectFit: "contain" }} />
              ) : (
                <View style={styles.signLine} />
              )}
              <Text style={styles.cardMuted}>
                {[model.company.signatoryName, model.company.signatoryRole, model.company.name]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>
        ) : null}

        {model.terms ? (
          <View style={{ marginTop: 12 }} wrap>
            <Text style={[styles.cardLabel, { color: accent }]}>TERMS</Text>
            <Text style={styles.cardMuted}>{model.terms}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {model.footerContacts.map((c) => c.value).join("   ·   ") || model.company.name}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${model.quote.number}${model.showPoweredBy ? "  ·  Powered by SegmiQ" : ""}  ·  ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderLayoutPdf(model: QuoteDocumentModel): Promise<Buffer> {
  return renderToBuffer(<ResidentialPremiumSolarDocument model={model} />);
}
