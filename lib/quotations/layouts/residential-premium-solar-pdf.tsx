import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatMoneyCompact } from "@/lib/quotations/totals";
import type { QuoteDocumentModel } from "./types";
import { TEMPLATE_CHARCOAL, TEMPLATE_INK, TEMPLATE_LINE, TEMPLATE_MUTED } from "./types";
import { isSvgSrc } from "./resolve-image";
import { PdfIcon } from "./pdf-icons";
import { signatoryParts, splitHeroLines, termsNeedOwnPage } from "./map-fields";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

const HERO_H = 128;

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 8,
    color: TEMPLATE_INK,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  header: { flexDirection: "row", alignItems: "flex-start", minHeight: 52 },
  brandCol: { width: "50%", paddingRight: 10 },
  logo: { width: 92, height: 24, objectFit: "contain", objectPosition: "0% 50%" },
  companyName: { fontSize: 14, fontWeight: 700, letterSpacing: 0.2 },
  brandRule: { width: 26, height: 1.5, marginTop: 4 },
  tagline: { fontSize: 6.5, color: TEMPLATE_MUTED, marginTop: 3, letterSpacing: 0.15 },
  titleCol: { width: "25%", alignItems: "center", paddingTop: 10 },
  metaCol: { width: "25%", alignItems: "flex-end" },
  badge: {
    fontSize: 5.5,
    fontWeight: 700,
    letterSpacing: 0.65,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    marginBottom: 5,
    borderRadius: 2,
    alignSelf: "flex-end",
  },
  quoteTitle: { fontSize: 14, fontWeight: 700, letterSpacing: 0.8 },
  metaRow: { flexDirection: "row", marginTop: 1.5, justifyContent: "flex-end" },
  metaLabel: { fontSize: 6, color: TEMPLATE_MUTED, width: 54, textAlign: "right", marginRight: 5 },
  metaValue: { fontSize: 7, fontWeight: 700, width: 78, textAlign: "right" },
  hero: { marginTop: 8, height: HERO_H, overflow: "hidden", position: "relative" },
  heroImg: { width: "100%", height: HERO_H, objectFit: "cover", objectPosition: "78% 42%" },
  heroFallback: { width: "100%", height: HERO_H, backgroundColor: "#1C1C1C" },
  heroShade: { position: "absolute", left: 0, top: 0, width: "100%", height: HERO_H },
  heroCopy: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "48%",
    paddingVertical: 16,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  heroHeadline: { fontSize: 15, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.12 },
  heroRule: { width: 28, height: 1.5, marginTop: 6 },
  heroSub: { marginTop: 6, fontSize: 7, color: "#F2F2F2", lineHeight: 1.3, maxWidth: 200 },
  cards: { flexDirection: "row", marginTop: 7, alignItems: "stretch" },
  card: {
    flex: 1,
    borderWidth: 0.7,
    borderColor: TEMPLATE_LINE,
    borderRadius: 5,
    padding: 6,
    marginRight: 5,
  },
  cardLast: { marginRight: 0 },
  cardHead: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  cardLabel: { fontSize: 6, fontWeight: 700, letterSpacing: 0.6, marginLeft: 3 },
  fieldRow: { flexDirection: "row", marginTop: 1.5 },
  fieldLabel: { width: "38%", fontSize: 6.5, color: TEMPLATE_MUTED },
  fieldValue: { width: "62%", fontSize: 7, fontWeight: 700, lineHeight: 1.25 },
  summaryText: { fontSize: 7, lineHeight: 1.3 },
  kpi: {
    marginTop: 7,
    flexDirection: "row",
    borderTopWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: TEMPLATE_LINE,
    paddingVertical: 6,
  },
  kpiCell: { flex: 1, paddingHorizontal: 7 },
  kpiHead: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  kpiLabel: { fontSize: 6, fontWeight: 700, letterSpacing: 0.5, marginLeft: 3 },
  kpiValue: { fontSize: 10, fontWeight: 700 },
  kpiSub: { fontSize: 6, color: TEMPLATE_MUTED, marginTop: 1 },
  kpiDivider: { width: 0.6, backgroundColor: TEMPLATE_LINE },
  tableWrap: { marginTop: 8 },
  tableBanner: { backgroundColor: TEMPLATE_CHARCOAL, paddingVertical: 4.5, paddingHorizontal: 8 },
  tableBannerText: { color: "#FFFFFF", fontSize: 7, fontWeight: 700, letterSpacing: 0.85 },
  tableHead: {
    flexDirection: "row",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: TEMPLATE_LINE,
    backgroundColor: "#FAFAFA",
  },
  th: { fontSize: 6, color: TEMPLATE_MUTED, fontWeight: 700, letterSpacing: 0.25 },
  tr: {
    flexDirection: "row",
    paddingVertical: 2.75,
    paddingHorizontal: 6,
    borderBottomWidth: 0.4,
    borderBottomColor: TEMPLATE_LINE,
    borderRightWidth: 0,
  },
  cNum: { width: "4%" },
  cDesc: { width: "26%", paddingRight: 4 },
  cBrand: { width: "20%", paddingRight: 4 },
  cQty: { width: "8%", textAlign: "right" },
  cUnit: { width: "8%", textAlign: "right" },
  cPrice: { width: "16%", textAlign: "right" },
  cAmt: { width: "18%", textAlign: "right" },
  itemName: { fontSize: 7, fontWeight: 700 },
  itemDesc: { fontSize: 6.5, color: TEMPLATE_MUTED },
  sectionBar: { backgroundColor: "#F4F4F4", paddingVertical: 2.5, paddingHorizontal: 6 },
  lower: { flexDirection: "row", marginTop: 8, alignItems: "stretch" },
  lowerCol: {
    borderWidth: 0.7,
    borderColor: TEMPLATE_LINE,
    borderRadius: 5,
    padding: 6,
    marginRight: 5,
  },
  payCol: { flexGrow: 23, flexShrink: 1, flexBasis: 0 },
  warCol: { flexGrow: 23, flexShrink: 1, flexBasis: 0 },
  sumCol: { flexGrow: 23, flexShrink: 1, flexBasis: 0 },
  totalBox: {
    flexGrow: 31,
    flexShrink: 1,
    flexBasis: 0,
    marginRight: 0,
    borderWidth: 1.2,
    borderRadius: 5,
    paddingVertical: 7,
    paddingHorizontal: 7,
    justifyContent: "center",
  },
  totalLabel: { fontSize: 6, fontWeight: 700, letterSpacing: 0.55 },
  totalValue: { fontSize: 13, fontWeight: 700, marginTop: 3 },
  totalWords: { fontSize: 6, color: TEMPLATE_MUTED, marginTop: 4, lineHeight: 1.25 },
  kv: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  signRow: { flexDirection: "row", marginTop: 9 },
  signCol: { flex: 1, marginRight: 14 },
  acceptRow: { flexDirection: "row", marginTop: 4, alignItems: "flex-end" },
  acceptLabel: { width: 58, fontSize: 6.5, color: TEMPLATE_MUTED },
  acceptLine: { flex: 1, borderBottomWidth: 0.55, borderBottomColor: TEMPLATE_LINE, height: 10 },
  sealBox: { marginTop: 6, height: 28, borderWidth: 0.7, borderColor: TEMPLATE_LINE, borderRadius: 3 },
  termsCard: {
    marginTop: 7,
    borderWidth: 0.7,
    borderColor: TEMPLATE_LINE,
    borderRadius: 5,
    padding: 6,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.55,
    borderTopColor: TEMPLATE_LINE,
    paddingTop: 4,
  },
  footerItem: { flexDirection: "row", alignItems: "center", marginRight: 8 },
  footerText: { fontSize: 6, color: TEMPLATE_MUTED, marginLeft: 2.5 },
  continued: {
    position: "absolute",
    top: 12,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function HeroHeadline({
  text,
  accentWord,
  accent,
}: {
  text: string;
  accentWord: string | null;
  accent: string;
}) {
  const lines = splitHeroLines(text);
  const accentLc = (accentWord || "").trim().toLowerCase();
  return (
    <View>
      {lines.map((line) => {
        const emphasised = Boolean(accentLc) && line.toLowerCase().includes(accentLc);
        return (
          <Text key={line} style={emphasised ? [styles.heroHeadline, { color: accent }] : styles.heroHeadline}>
            {line}
          </Text>
        );
      })}
    </View>
  );
}

function CardHeading({
  icon,
  label,
  accent,
}: {
  icon: Parameters<typeof PdfIcon>[0]["name"];
  label: string;
  accent: string;
}) {
  return (
    <View style={styles.cardHead}>
      <PdfIcon name={icon} color={accent} />
      <Text style={[styles.cardLabel, { color: accent }]}>{label}</Text>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function ResidentialPremiumSolarDocument({ model }: { model: QuoteDocumentModel }) {
  const accent = model.accent;
  const currency = model.quote.currency;
  const money = (n: number) => formatMoneyCompact(n, currency);
  const signatory = signatoryParts(model.company);
  const longTerms = termsNeedOwnPage(model.terms);
  const hasCustomer = Boolean(
    model.customer.name || model.customer.phone || model.customer.email || model.customer.address
  );
  const infoCards = [
    hasCustomer,
    model.site.length > 0,
    Boolean(model.projectSummary),
  ].filter(Boolean).length;
  let running = 0;
  const kpiIcon = (id: string) =>
    id === "size" ? "panel" : id === "gen" ? "zap" : id === "pr" ? "chart" : "leaf";

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
          <View style={styles.brandCol}>
            {model.company.logoDataUri ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={styles.logo} src={model.company.logoDataUri} />
            ) : (
              <View>
                <Text style={styles.companyName}>{model.company.name}</Text>
                <View style={[styles.brandRule, { backgroundColor: accent }]} />
              </View>
            )}
            {model.company.tagline ? <Text style={styles.tagline}>{model.company.tagline}</Text> : null}
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.quoteTitle}>QUOTATION</Text>
          </View>
          <View style={styles.metaCol}>
            {model.badge ? (
              <Text style={[styles.badge, { backgroundColor: accent, color: TEMPLATE_INK }]}>{model.badge}</Text>
            ) : null}
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

        <View style={styles.hero} wrap={false}>
          {model.hero.imageSrc && !isSvgSrc(model.hero.imageSrc) ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.heroImg} src={model.hero.imageSrc} />
          ) : (
            <View style={styles.heroFallback} />
          )}
          <Svg style={styles.heroShade} width="523" height={HERO_H} viewBox="0 0 100 50" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="heroShade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.88" />
                <Stop offset="0.38" stopColor="#000000" stopOpacity="0.5" />
                <Stop offset="0.72" stopColor="#000000" stopOpacity="0.08" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="50" fill="url(#heroShade)" />
          </Svg>
          <View style={styles.heroCopy}>
            <HeroHeadline text={model.hero.headline} accentWord={model.hero.accentWord} accent={accent} />
            <View style={[styles.heroRule, { backgroundColor: accent }]} />
            {model.hero.subcopy ? <Text style={styles.heroSub}>{model.hero.subcopy}</Text> : null}
          </View>
        </View>

        {infoCards > 0 ? (
          <View style={styles.cards} wrap={false}>
            {hasCustomer ? (
              <View style={[styles.card, infoCards === 1 ? styles.cardLast : {}]}>
                <CardHeading icon="user" label="CUSTOMER INFORMATION" accent={accent} />
                {model.customer.name ? <Field label="Name" value={model.customer.name} /> : null}
                {model.customer.phone ? <Field label="Phone" value={model.customer.phone} /> : null}
                {model.customer.email ? <Field label="Email" value={model.customer.email} /> : null}
                {model.customer.address ? <Field label="Address" value={model.customer.address} /> : null}
              </View>
            ) : null}
            {model.site.length > 0 ? (
              <View style={[styles.card, !model.projectSummary ? styles.cardLast : {}]}>
                <CardHeading icon="pin" label="SITE / PROPERTY INFORMATION" accent={accent} />
                {model.site.slice(0, 8).map((row) => (
                  <Field key={row.label} label={row.label} value={row.value} />
                ))}
              </View>
            ) : null}
            {model.projectSummary ? (
              <View style={[styles.card, styles.cardLast]}>
                <CardHeading icon="sun" label="PROJECT SUMMARY" accent={accent} />
                <Text style={styles.summaryText}>{model.projectSummary}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {model.metrics.length > 0 ? (
          <View style={styles.kpi} wrap={false}>
            {model.metrics.map((m, i) => (
              <View key={m.id} style={{ flex: 1, flexDirection: "row" }}>
                {i > 0 ? <View style={styles.kpiDivider} /> : null}
                <View style={styles.kpiCell}>
                  <View style={styles.kpiHead}>
                    <PdfIcon name={kpiIcon(m.id)} color={accent} />
                    <Text style={[styles.kpiLabel, { color: accent }]}>{m.label.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.kpiValue}>{m.value}</Text>
                  {m.secondary ? <Text style={styles.kpiSub}>{m.secondary}</Text> : null}
                </View>
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
          {model.sections.length === 0 || model.sections.every((s) => s.items.length === 0) ? (
            <View style={styles.tr} wrap={false}>
              <Text style={[styles.itemDesc, { paddingVertical: 4 }]}>No equipment listed yet.</Text>
            </View>
          ) : (
            model.sections.map((section) => (
              <View key={section.title || "main"} wrap>
                {section.title ? (
                  <View style={styles.sectionBar} wrap={false}>
                    <Text style={styles.itemName}>{section.title.toUpperCase()}</Text>
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
                      <Text style={[styles.cPrice, styles.itemDesc]}>{money(it.unitPrice)}</Text>
                      <Text style={[styles.cAmt, styles.itemName]}>{money(it.amount)}</Text>
                    </View>
                  );
                })}
              </View>
            ))
          )}
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
                <Text style={[styles.cPrice, styles.itemDesc]}>{money(it.unitPrice)}</Text>
                <Text style={[styles.cAmt, styles.itemName]}>{money(it.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.lower} wrap={false}>
          {model.paymentTerms.length > 0 ? (
            <View style={[styles.lowerCol, styles.payCol]}>
              <CardHeading icon="pay" label="PAYMENT TERMS" accent={accent} />
              {model.paymentTerms.map((p) => (
                <View key={p.label} style={styles.kv}>
                  <Text style={styles.itemName}>
                    {p.label}
                    {p.amountLabel ? ` (${p.amountLabel})` : ""}
                  </Text>
                  <Text style={styles.itemDesc}>{p.detail || ""}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {model.warranty.length > 0 ? (
            <View style={[styles.lowerCol, styles.warCol]}>
              <CardHeading icon="shield" label="WARRANTY" accent={accent} />
              {model.warranty.map((w) => (
                <View key={w.label} style={styles.kv}>
                  <Text style={styles.itemDesc}>{w.label}</Text>
                  <Text style={styles.itemName}>{w.detail}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={[styles.lowerCol, styles.sumCol, !model.showAcceptance && !model.terms ? styles.cardLast : {}]}>
            <CardHeading icon="summary" label="COMMERCIAL SUMMARY" accent={accent} />
            <View style={styles.kv}>
              <Text style={styles.itemDesc}>Subtotal</Text>
              <Text style={styles.itemName}>{money(model.commercial.subtotal)}</Text>
            </View>
            {model.commercial.discountTotal > 0 ? (
              <View style={styles.kv}>
                <Text style={styles.itemDesc}>Discount</Text>
                <Text style={styles.itemName}>{money(model.commercial.discountTotal)}</Text>
              </View>
            ) : null}
            {model.commercial.taxRate > 0 || model.commercial.taxAmount > 0 ? (
              <View style={styles.kv}>
                <Text style={styles.itemDesc}>
                  Tax{model.commercial.taxRate ? ` (${model.commercial.taxRate}%)` : ""}
                </Text>
                <Text style={styles.itemName}>{money(model.commercial.taxAmount)}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.totalBox, { borderColor: accent }]}>
            <Text style={[styles.totalLabel, { color: accent }]}>TOTAL AMOUNT ({currency})</Text>
            <Text
              style={[
                styles.totalValue,
                { color: accent, fontSize: String(Math.round(model.commercial.total)).length > 8 ? 11 : 13 },
              ]}
            >
              {money(model.commercial.total)}
            </Text>
            {model.commercial.amountInWords ? (
              <Text style={styles.totalWords}>({model.commercial.amountInWords})</Text>
            ) : null}
          </View>
        </View>

        {model.showAcceptance ? (
          <View style={styles.signRow} wrap={false}>
            <View style={styles.signCol}>
              <CardHeading icon="user" label="ACCEPTED BY" accent={accent} />
              <View style={styles.acceptRow}>
                <Text style={styles.acceptLabel}>Name</Text>
                <View style={styles.acceptLine} />
              </View>
              <View style={styles.acceptRow}>
                <Text style={styles.acceptLabel}>Designation</Text>
                <View style={styles.acceptLine} />
              </View>
              <View style={styles.acceptRow}>
                <Text style={styles.acceptLabel}>Date</Text>
                <View style={styles.acceptLine} />
              </View>
              <Text style={[styles.acceptLabel, { marginTop: 6 }]}>Signature & Seal</Text>
              <View style={styles.sealBox} />
            </View>
            <View style={[styles.signCol, { marginRight: 0 }]}>
              <CardHeading icon="summary" label="AUTHORISED SIGNATORY" accent={accent} />
              {model.company.signatureDataUri ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={model.company.signatureDataUri} style={{ width: 90, height: 28, marginTop: 8, objectFit: "contain" }} />
              ) : (
                <View style={[styles.acceptLine, { marginTop: 22 }]} />
              )}
              <Text style={[styles.itemName, { marginTop: 6 }]}>{signatory.name}</Text>
              {signatory.role ? <Text style={styles.itemDesc}>{signatory.role}</Text> : null}
              <Text style={styles.itemDesc}>{signatory.company}</Text>
            </View>
          </View>
        ) : null}

        {model.terms && !longTerms ? (
          <View style={styles.termsCard} wrap={false}>
            <Text style={[styles.cardLabel, { color: accent, marginBottom: 4 }]}>TERMS</Text>
            <Text style={styles.summaryText}>{model.terms}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <View style={{ flexDirection: "row", flexWrap: "wrap", flex: 1, paddingRight: 8 }}>
            {model.footerContacts.map((c) => (
              <View key={`${c.kind}-${c.value}`} style={styles.footerItem}>
                <PdfIcon
                  name={c.kind === "phone" ? "phone" : c.kind === "email" ? "mail" : c.kind === "web" ? "web" : "pin"}
                  color={accent}
                  size={8}
                />
                <Text style={styles.footerText}>{c.value}</Text>
              </View>
            ))}
          </View>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${model.quote.number}${model.showPoweredBy ? "  ·  Powered by SegmiQ" : ""}  ·  ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>

      {model.terms && longTerms ? (
        <Page size="A4" style={styles.page}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <View>
              <Text style={styles.companyName}>{model.company.name}</Text>
              <Text style={styles.tagline}>{model.quote.number} · {model.customer.name || "Customer"}</Text>
            </View>
            <Text style={styles.quoteTitle}>TERMS & CONDITIONS</Text>
          </View>
          {model.terms.split(/\n/).filter(Boolean).map((clause) => (
            <Text key={clause.slice(0, 24)} style={[styles.summaryText, { marginBottom: 6 }]}>
              {clause}
            </Text>
          ))}
          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>{model.company.name}</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) => `${model.quote.number}  ·  ${pageNumber} / ${totalPages}`}
            />
          </View>
        </Page>
      ) : null}
    </Document>
  );
}

export async function renderLayoutPdf(model: QuoteDocumentModel): Promise<Buffer> {
  return renderToBuffer(<ResidentialPremiumSolarDocument model={model} />);
}
