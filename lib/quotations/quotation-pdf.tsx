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

const INK = "#0A0A0A";
const MUTED = "#6B7280";
const HAIRLINE = "#E5E7EB";
const ZEBRA = "#F8FAFC";

export type QuotationPdfLineItem = {
  item_name: string;
  description: string | null;
  unit_price: number;
  quantity: number;
  amount: number;
  group_label: string | null;
};

export type QuotationPdfData = {
  brandColor: string;
  logoDataUri: string | null;
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;

  quoteNumber: string;
  issuedAt: Date;
  validUntil: Date | null;
  preparedBy: string | null;
  customerId: string | null;

  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;

  currency: string;
  items: QuotationPdfLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  otherAmount: number;
  total: number;

  notes: string | null;
  terms: string | null;
  footerNote: string | null;
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 9.5,
    color: INK,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandCol: { flexDirection: "row", alignItems: "flex-start", maxWidth: 320 },
  logo: { width: 54, height: 54, objectFit: "contain", marginRight: 12 },
  companyName: { fontSize: 16, fontWeight: 700, letterSpacing: -0.3 },
  companyMeta: { fontSize: 8.5, color: MUTED, marginTop: 3, lineHeight: 1.5 },
  quoteTitle: { fontSize: 24, fontWeight: 700, textAlign: "right" },
  metaBox: { marginTop: 10, alignItems: "flex-end" },
  metaLine: { flexDirection: "row", marginTop: 3 },
  metaLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, width: 70, textAlign: "right", marginRight: 8 },
  metaValue: { fontSize: 9, fontWeight: 700, width: 90, textAlign: "right" },
  accentRule: { marginTop: 16, height: 3, borderRadius: 2 },

  twoCol: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  blockLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  customerName: { fontSize: 11, fontWeight: 700 },
  customerLine: { fontSize: 9, color: MUTED, marginTop: 2 },
  noteBox: { borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4, padding: 10, maxWidth: 200 },
  noteText: { fontSize: 8.5, color: INK, lineHeight: 1.5 },

  table: { marginTop: 22 },
  tableHeader: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 6 },
  th: { fontSize: 8, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 },
  groupRow: { paddingVertical: 5, paddingHorizontal: 6, marginTop: 4 },
  groupLabel: { fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: INK },
  row: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: HAIRLINE },
  cItem: { width: "26%", paddingRight: 6 },
  cDesc: { width: "34%", paddingRight: 6 },
  cUnit: { width: "14%", textAlign: "right", paddingRight: 6 },
  cQty: { width: "10%", textAlign: "right", paddingRight: 6 },
  cAmt: { width: "16%", textAlign: "right" },
  itemName: { fontSize: 9, fontWeight: 700 },
  itemDesc: { fontSize: 8.5, color: MUTED },
  cell: { fontSize: 9 },

  totals: { marginTop: 14, flexDirection: "row", justifyContent: "flex-end" },
  totalsTable: { width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9, fontWeight: 700 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, paddingHorizontal: 8, marginTop: 4, borderRadius: 3 },
  grandLabel: { fontSize: 11, fontWeight: 700, color: "#FFFFFF" },
  grandValue: { fontSize: 12, fontWeight: 700, color: "#FFFFFF" },

  termsBlock: { marginTop: 26 },
  termsTitle: { fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  termsText: { fontSize: 8.5, color: INK, lineHeight: 1.6 },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: MUTED },
});

function QuotationDocument({ data }: { data: QuotationPdfData }) {
  const brand = data.brandColor || "#0F7A4F";
  let lastGroup: string | null = null;

  return (
    <Document title={`Quotation ${data.quoteNumber}`} author={data.companyName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.brandCol}>
            {data.logoDataUri ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image style={styles.logo} src={data.logoDataUri} />
            ) : null}
            <View>
              <Text style={styles.companyName}>{data.companyName}</Text>
              <Text style={styles.companyMeta}>
                {[data.companyAddress, data.companyPhone, data.companyEmail, data.companyWebsite]
                  .filter(Boolean)
                  .join("\n")}
              </Text>
            </View>
          </View>
          <View>
            <Text style={[styles.quoteTitle, { color: brand }]}>Quotation</Text>
            <View style={styles.metaBox}>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Quote #</Text>
                <Text style={styles.metaValue}>{data.quoteNumber}</Text>
              </View>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>{formatDate(data.issuedAt)}</Text>
              </View>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Valid until</Text>
                <Text style={styles.metaValue}>{formatDate(data.validUntil)}</Text>
              </View>
              {data.customerId ? (
                <View style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Customer ID</Text>
                  <Text style={styles.metaValue}>{data.customerId}</Text>
                </View>
              ) : null}
              {data.preparedBy ? (
                <View style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Prepared by</Text>
                  <Text style={styles.metaValue}>{data.preparedBy}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.accentRule, { backgroundColor: brand }]} />

        <View style={styles.twoCol}>
          <View>
            <Text style={styles.blockLabel}>Quote for</Text>
            <Text style={styles.customerName}>{data.customerName || "—"}</Text>
            {data.customerPhone ? <Text style={styles.customerLine}>{data.customerPhone}</Text> : null}
            {data.customerEmail ? <Text style={styles.customerLine}>{data.customerEmail}</Text> : null}
          </View>
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              {data.notes?.trim() || `Please note that all prices are in ${data.currency}.`}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableHeader, { backgroundColor: brand }]}>
            <Text style={[styles.th, styles.cItem]}>Item</Text>
            <Text style={[styles.th, styles.cDesc]}>Description</Text>
            <Text style={[styles.th, styles.cUnit]}>Unit price</Text>
            <Text style={[styles.th, styles.cQty]}>Qty</Text>
            <Text style={[styles.th, styles.cAmt]}>Amount</Text>
          </View>

          {data.items.map((it, i) => {
            const showGroup = it.group_label && it.group_label !== lastGroup;
            lastGroup = it.group_label ?? lastGroup;
            return (
              <View key={i} wrap={false}>
                {showGroup ? (
                  <View style={[styles.groupRow, { backgroundColor: ZEBRA }]}>
                    <Text style={styles.groupLabel}>{it.group_label}</Text>
                  </View>
                ) : null}
                <View style={[styles.row, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
                  <View style={styles.cItem}>
                    <Text style={styles.itemName}>{it.item_name}</Text>
                  </View>
                  <Text style={[styles.cDesc, styles.itemDesc]}>{it.description || ""}</Text>
                  <Text style={[styles.cUnit, styles.cell]}>{formatMoney(it.unit_price, data.currency)}</Text>
                  <Text style={[styles.cQty, styles.cell]}>{it.quantity}</Text>
                  <Text style={[styles.cAmt, styles.itemName]}>{formatMoney(it.amount, data.currency)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatMoney(data.subtotal, data.currency)}</Text>
            </View>
            {data.taxRate > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({data.taxRate}%)</Text>
                <Text style={styles.totalValue}>{formatMoney(data.taxAmount, data.currency)}</Text>
              </View>
            ) : null}
            {data.otherAmount ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Other</Text>
                <Text style={styles.totalValue}>{formatMoney(data.otherAmount, data.currency)}</Text>
              </View>
            ) : null}
            <View style={[styles.grandRow, { backgroundColor: brand }]}>
              <Text style={styles.grandLabel}>TOTAL</Text>
              <Text style={styles.grandValue}>{formatMoney(data.total, data.currency)}</Text>
            </View>
          </View>
        </View>

        {data.terms?.trim() ? (
          <View style={styles.termsBlock}>
            <Text style={styles.termsTitle}>Terms &amp; conditions</Text>
            <Text style={styles.termsText}>{data.terms}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{data.footerNote || data.companyName}</Text>
          <Text style={styles.footerText}>Quotation {data.quoteNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
  return renderToBuffer(<QuotationDocument data={data} />);
}
