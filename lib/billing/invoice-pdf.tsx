import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

/**
 * Printable A4 invoice — deliberately black-on-white (this is a document, not the
 * dark CRM portal). The only brand colour is a thin lime accent rule under the
 * "Segmiq" wordmark, matching the marketing accent #D4FF4F.
 */

const LIME = "#D4FF4F";
const INK = "#0A0A0A";
const MUTED = "#6B7280";
const HAIRLINE = "#E5E7EB";

export type InvoicePdfData = {
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date;
  clientName: string;
  clientEmail: string | null;
  planLabel: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  amount: number;
  currency: string;
  payment: {
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    bankBranch: string | null;
    swift: string | null;
    mobileMoneyNumber: string | null;
    mobileMoneyName: string | null;
    instructions: string | null;
  };
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontSize: 10,
    color: INK,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  wordmark: { fontSize: 22, fontWeight: 700, letterSpacing: -0.5 },
  accentRule: { marginTop: 6, width: 56, height: 3, backgroundColor: LIME },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  invoiceTag: { fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
  invoiceNumber: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  metaRight: { alignItems: "flex-end" },
  metaLine: { fontSize: 9, color: MUTED, marginTop: 2 },
  metaValue: { color: INK, fontWeight: 700 },
  section: { marginTop: 28 },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  billToName: { fontSize: 11, fontWeight: 700 },
  billToEmail: { fontSize: 9, color: MUTED, marginTop: 2 },
  table: { marginTop: 24, borderTopWidth: 1, borderTopColor: INK },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  colDesc: { flex: 1 },
  colAmount: { width: 110, textAlign: "right" },
  th: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
  lineItemTitle: { fontSize: 10, fontWeight: 700 },
  lineItemSub: { fontSize: 9, color: MUTED, marginTop: 3 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  totalLabel: { fontSize: 10, color: MUTED, marginRight: 24, alignSelf: "center" },
  totalValue: { fontSize: 16, fontWeight: 700 },
  payBlock: {
    marginTop: 36,
    padding: 16,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 4,
  },
  payTitle: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  payGrid: { flexDirection: "row", flexWrap: "wrap" },
  payCell: { width: "50%", marginBottom: 8 },
  payCellLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 },
  payCellValue: { fontSize: 10, marginTop: 2 },
  payInstructions: { fontSize: 9, color: INK, marginTop: 6, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 10,
  },
  footerText: { fontSize: 8, color: MUTED },
});

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function PayCell({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.payCell}>
      <Text style={styles.payCellLabel}>{label}</Text>
      <Text style={styles.payCellValue}>{value}</Text>
    </View>
  );
}

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const period =
    data.periodStart && data.periodEnd
      ? `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`
      : "Current period";
  const p = data.payment;
  const hasBank = Boolean(
    p.bankName || p.bankAccountName || p.bankAccountNumber || p.bankBranch || p.swift
  );
  const hasMomo = Boolean(p.mobileMoneyNumber || p.mobileMoneyName);

  return (
    <Document title={`Invoice ${data.invoiceNumber}`} author="Segmiq">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.wordmark}>Segmiq</Text>
            <View style={styles.accentRule} />
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.invoiceTag}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <Text style={styles.metaLine}>
              Issued <Text style={styles.metaValue}>{formatDate(data.issuedAt)}</Text>
            </Text>
            <Text style={styles.metaLine}>
              Due <Text style={styles.metaValue}>{formatDate(data.dueAt)}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bill to</Text>
          <Text style={styles.billToName}>{data.clientName}</Text>
          {data.clientEmail ? <Text style={styles.billToEmail}>{data.clientEmail}</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.colDesc}>
              <Text style={styles.lineItemTitle}>Segmiq CRM — {data.planLabel} plan</Text>
              <Text style={styles.lineItemSub}>Service period: {period}</Text>
            </View>
            <Text style={[styles.colAmount, styles.lineItemTitle]}>
              {formatMoney(data.amount, data.currency)}
            </Text>
          </View>
        </View>

        <View style={styles.totalsRow}>
          <Text style={styles.totalLabel}>Total due</Text>
          <Text style={styles.totalValue}>{formatMoney(data.amount, data.currency)}</Text>
        </View>

        <View style={styles.payBlock}>
          <Text style={styles.payTitle}>How to pay</Text>
          {hasBank ? (
            <View style={styles.payGrid}>
              <PayCell label="Bank" value={p.bankName} />
              <PayCell label="Account name" value={p.bankAccountName} />
              <PayCell label="Account number" value={p.bankAccountNumber} />
              <PayCell label="Branch" value={p.bankBranch} />
              <PayCell label="SWIFT" value={p.swift} />
            </View>
          ) : null}
          {hasMomo ? (
            <View style={styles.payGrid}>
              <PayCell label="Mobile money" value={p.mobileMoneyNumber} />
              <PayCell label="Mobile money name" value={p.mobileMoneyName} />
            </View>
          ) : null}
          {p.instructions ? <Text style={styles.payInstructions}>{p.instructions}</Text> : null}
          {!hasBank && !hasMomo && !p.instructions ? (
            <Text style={styles.payInstructions}>
              Payment details will be provided by Segmiq separately.
            </Text>
          ) : null}
          <Text style={styles.payInstructions}>
            Please reference invoice {data.invoiceNumber} with your payment.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Segmiq</Text>
          <Text style={styles.footerText}>{data.invoiceNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
