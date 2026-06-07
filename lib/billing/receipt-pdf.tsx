import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const LIME = "#D4FF4F";
const INK = "#0A0A0A";
const MUTED = "#6B7280";
const HAIRLINE = "#E5E7EB";

export type ReceiptPdfData = {
  receiptNumber: string;
  issuedAt: Date;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  method: string;
  methodDetail: string | null;
  reference: string | null;
  paidAt: Date | null;
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
  docTag: { fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: 1 },
  docNumber: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  paidBadge: {
    marginTop: 6,
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: INK,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.2,
  },
  metaRight: { alignItems: "flex-end" },
  metaLine: { fontSize: 9, color: MUTED, marginTop: 2 },
  metaValue: { color: INK, fontWeight: 700 },
  section: { marginTop: 28 },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  billToName: { fontSize: 11, fontWeight: 700 },
  detailBox: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 4,
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 9, color: MUTED },
  detailValue: { fontSize: 10, fontWeight: 700 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    alignItems: "center",
    gap: 16,
  },
  totalLabel: { fontSize: 10, color: MUTED },
  totalValue: { fontSize: 18, fontWeight: 700 },
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

function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, ...(last ? [styles.detailRowLast] : [])]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ReceiptDocument({ data }: { data: ReceiptPdfData }) {
  return (
    <Document title={`Receipt ${data.receiptNumber}`} author="Segmiq">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.wordmark}>Segmiq</Text>
            <View style={styles.accentRule} />
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.docTag}>Receipt</Text>
            <Text style={styles.docNumber}>{data.receiptNumber}</Text>
            <Text style={styles.paidBadge}>PAID</Text>
            <Text style={styles.metaLine}>
              Issued <Text style={styles.metaValue}>{formatDate(data.issuedAt)}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Received from</Text>
          <Text style={styles.billToName}>{data.clientName}</Text>
        </View>

        <View style={styles.detailBox}>
          <DetailRow label="Settles invoice" value={data.invoiceNumber} />
          <DetailRow label="Payment method" value={data.method} />
          {data.methodDetail ? (
            <DetailRow label="Method detail" value={data.methodDetail} />
          ) : null}
          {data.reference ? <DetailRow label="Reference" value={data.reference} /> : null}
          <DetailRow label="Date paid" value={formatDate(data.paidAt)} last />
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Amount received</Text>
          <Text style={styles.totalValue}>{formatMoney(data.amount, data.currency)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Segmiq</Text>
          <Text style={styles.footerText}>{data.receiptNumber}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return renderToBuffer(<ReceiptDocument data={data} />);
}
