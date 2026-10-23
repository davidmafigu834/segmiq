import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatUsd } from "@/lib/commercial/catalogue";
import type { QuoteSnapshot } from "@/lib/platform-sales/types";
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, color: "#101010" },
  header: { fontSize: 22, fontWeight: 700 },
  muted: { color: "#666666", marginTop: 4 },
  rule: { height: 3, backgroundColor: "#D4FF4F", marginVertical: 18 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#DDDDDD",
    paddingVertical: 7,
  },
  name: { width: "42%" },
  qty: { width: "12%", textAlign: "right" },
  price: { width: "22%", textAlign: "right" },
  amount: { width: "24%", textAlign: "right" },
  totals: { marginTop: 18, marginLeft: "auto", width: 260 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  grand: { fontSize: 12, fontWeight: 700, marginTop: 7 },
  note: { marginTop: 24, lineHeight: 1.5 },
});
export async function renderPlatformSalesQuotePdf(input: {
  quoteNumber: string;
  organisationName: string;
  contactName: string;
  validUntil: string;
  snapshot: QuoteSnapshot;
  notes?: string | null;
}) {
  const d = (
    <Document
      title={`SegmiQ offer ${input.quoteNumber}`}
      author="Adlense Network"
    >
      <Page size="A4" style={s.page}>
        <Text style={s.header}>SegmiQ Commercial Offer</Text>
        <Text style={s.muted}>
          {input.quoteNumber} · valid until {input.validUntil}
        </Text>
        <View style={s.rule} />
        <Text>Prepared for</Text>
        <Text>{input.organisationName}</Text>
        <Text style={s.muted}>{input.contactName}</Text>
        <View style={{ marginTop: 20 }}>
          <View style={s.row}>
            <Text style={s.name}>Item</Text>
            <Text style={s.qty}>Qty</Text>
            <Text style={s.price}>Unit price</Text>
            <Text style={s.amount}>Subtotal</Text>
          </View>
          {input.snapshot.lines.map((line) => (
            <View key={line.sku} style={s.row}>
              <Text style={s.name}>{line.name}</Text>
              <Text style={s.qty}>{line.quantity}</Text>
              <Text style={s.price}>{formatUsd(line.unitPriceUsdCents)}</Text>
              <Text style={s.amount}>{formatUsd(line.subtotalUsdCents)}</Text>
            </View>
          ))}
        </View>
        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text>Recurring monthly</Text>
            <Text>{formatUsd(input.snapshot.recurringTotalUsdCents)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>One-time services</Text>
            <Text>{formatUsd(input.snapshot.oneTimeTotalUsdCents)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>Tax</Text>
            <Text>{formatUsd(input.snapshot.taxUsdCents)}</Text>
          </View>
          <View style={[s.totalRow, s.grand]}>
            <Text>Initial due</Text>
            <Text>{formatUsd(input.snapshot.initialDueUsdCents)}</Text>
          </View>
        </View>
        {input.notes ? <Text style={s.note}>{input.notes}</Text> : null}
        <Text style={s.note}>
          Agentic AI allowances are commercial allowances and are not yet
          operationally metered. External messaging and provider charges are
          separate. Acceptance of this offer is not a signed service agreement
          or proof of payment.
        </Text>
      </Page>
    </Document>
  );
  return renderToBuffer(d);
}
