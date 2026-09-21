/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4
 * Redesign of the weekly sales PDF as an executive management document.
 * Genre: modern-minimal print. Motion: none. Density: balanced executive.
 */
import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Svg, Circle, Line, Path } from "@react-pdf/renderer";
import { QUOTATION_FONT_FAMILY } from "@/lib/quotations/fonts/register-roboto";
import {
  countLabel,
  formatDays,
  formatMetricValue,
  formatMinutes,
  formatPct,
  formatReportMoney,
  metricComparison,
  personMetric,
  splitCoverTitle,
  type ComparisonTone,
} from "./presentation";
import type {
  AttentionItem,
  ComparedMetric,
  ConversationPattern,
  FunnelStageResult,
  SalespersonNarrative,
  WeeklyReportPayload,
} from "./types";

const INK = "#0C0C0C";
const LIME = "#D4FF4F";
const PAPER = "#FFFFFF";
const WARM = "#F7F7F4";
const WARM2 = "#F4F3F0";
const LINE = "#E4E4DC";
const MUTED = "#5A5A5A";
const POSITIVE = "#3F6B1D";
const WARNING = "#8A5A2B";
const FONT = QUOTATION_FONT_FAMILY;

const PIPELINE_COLORS: Record<string, string> = {
  healthy: INK,
  needs_attention: "#C4A35A",
  at_risk: WARNING,
  stalled: "#5C4336",
  quoted_awaiting_followup: LIME,
};

const styles = StyleSheet.create({
  coverPage: {
    paddingTop: 44,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontFamily: FONT,
    color: INK,
    backgroundColor: WARM,
  },
  page: {
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: FONT,
    color: INK,
    backgroundColor: PAPER,
  },
  limeRail: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 6,
    backgroundColor: LIME,
  },
  header: {
    position: "absolute",
    top: 18,
    left: 40,
    right: 40,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 8,
    borderBottomWidth: 0.6,
    borderBottomColor: LINE,
  },
  headerOrg: { fontSize: 8, fontWeight: 700, color: INK, width: "34%" },
  headerTitle: { fontSize: 8, color: MUTED, width: "36%" },
  headerMeta: { fontSize: 8, color: MUTED, width: "30%", textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    paddingTop: 7,
  },
  coverFooter: {
    position: "absolute",
    bottom: 18,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
    borderTopWidth: 0.6,
    borderTopColor: LINE,
    paddingTop: 7,
  },
  coverBrand: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  logo: { width: 42, height: 42, objectFit: "contain", marginRight: 12 },
  orgName: { fontSize: 13, fontWeight: 700, letterSpacing: 0.1 },
  kicker: {
    fontSize: 7.5,
    color: MUTED,
    marginTop: 3,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  coverTitle: { fontSize: 28, fontWeight: 700, lineHeight: 1.12, letterSpacing: -0.4 },
  titleRule: { width: 36, height: 3, backgroundColor: LIME, marginTop: 14, marginBottom: 18 },
  periodLabel: { fontSize: 8, color: MUTED, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 },
  periodValue: { fontSize: 13, fontWeight: 500 },
  generated: { fontSize: 9.5, color: MUTED, marginTop: 10 },
  timezone: { fontSize: 8, color: MUTED, marginTop: 3 },
  prepared: {
    position: "absolute",
    left: 48,
    bottom: 44,
    fontSize: 9,
    color: MUTED,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 2,
  },
  sectionTick: { width: 3, height: 12, backgroundColor: LIME, marginRight: 8 },
  h2: { fontSize: 13, fontWeight: 700, letterSpacing: -0.15 },
  h3: { fontSize: 9, fontWeight: 700, marginBottom: 3 },
  p: { fontSize: 10, lineHeight: 1.48, marginBottom: 10 },
  muted: { color: MUTED },
  glance: {
    flexDirection: "row",
    backgroundColor: WARM,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  glanceCell: { width: "25%", paddingHorizontal: 8 },
  glanceValue: { fontSize: 13, fontWeight: 700 },
  glanceLabel: { fontSize: 7.5, color: MUTED, marginTop: 2, letterSpacing: 0.3 },
  insightGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  insight: {
    width: "48.5%",
    backgroundColor: WARM,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  insightText: { fontSize: 9.5, lineHeight: 1.4, fontWeight: 500 },
  factBox: {
    backgroundColor: WARM2,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  factLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: WARM2,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  tableRowAlt: { backgroundColor: WARM },
  th: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 },
  cell: { fontSize: 9.5 },
  num: { fontSize: 9.5, textAlign: "right" },
  analysis: {
    backgroundColor: WARM,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  analysisHead: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  qMark: {
    width: 12,
    height: 12,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  qMarkText: { fontSize: 8, fontWeight: 700, color: INK },
  analysisKicker: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: 700,
  },
  callout: {
    borderLeftWidth: 2.5,
    borderLeftColor: WARNING,
    backgroundColor: WARM,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  calloutTitle: { fontSize: 10.5, fontWeight: 700, marginBottom: 3 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, marginBottom: 8 },
  legendItem: { width: "50%", flexDirection: "row", paddingRight: 8, marginBottom: 7 },
  swatch: { width: 8, height: 8, marginTop: 2, marginRight: 6 },
  attentionRow: {
    backgroundColor: WARM,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginBottom: 4,
    borderLeftWidth: 2.5,
    borderLeftColor: INK,
  },
  attentionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  attentionName: { fontSize: 10, fontWeight: 700, width: "72%" },
  attentionValue: { fontSize: 10, fontWeight: 700, textAlign: "right", width: "28%" },
  tag: {
    fontSize: 7,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: MUTED,
    marginTop: 3,
    marginBottom: 3,
  },
  fieldLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 },
  person: {
    backgroundColor: WARM,
    padding: 8,
    marginBottom: 6,
  },
  personName: { fontSize: 10.5, fontWeight: 700, marginBottom: 6 },
  personStats: { flexDirection: "row", marginBottom: 8 },
  personStat: { width: "16.6%" },
  rec: { flexDirection: "row", marginBottom: 8 },
  recNum: { width: 28, fontSize: 12, fontWeight: 700, color: INK },
  recBody: { width: "90%" },
  recTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  priority: { flexDirection: "row", marginBottom: 8, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: LINE },
  agendaLine: { flexDirection: "row", marginBottom: 4 },
  agendaNum: { width: 18, fontSize: 10, fontWeight: 700 },
  empty: { backgroundColor: WARM, padding: 10, marginBottom: 8 },
  emptyValue: { fontSize: 12, fontWeight: 700, marginBottom: 3 },
});

function toneColor(tone: ComparisonTone): string {
  if (tone === "positive") return POSITIVE;
  if (tone === "negative") return WARNING;
  return MUTED;
}

function metricById(metrics: ComparedMetric[], id: string) {
  return metrics.find((metric) => metric.id === id) ?? null;
}

function Header({ org, period }: { org: string; period: string }) {
  return (
    <View style={styles.header} fixed>
      <Text style={styles.headerOrg}>{org}</Text>
      <Text style={styles.headerTitle}>Weekly Sales Performance Report</Text>
      <Text style={styles.headerMeta}>
        {period}  ·  SegmiQ
      </Text>
    </View>
  );
}

function Footer({ org }: { org: string; inset?: boolean }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Confidential  ·  {org}</Text>
      <Text>Generated by SegmiQ</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function CoverFooter({ org }: { org: string }) {
  return (
    <View style={styles.coverFooter} fixed>
      <Text>Confidential  ·  {org}</Text>
      <Text>Generated by SegmiQ</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={styles.sectionHead} wrap={false} minPresenceAhead={40}>
      <View style={styles.sectionTick} />
      <Text style={styles.h2}>{children}</Text>
    </View>
  );
}

function IntelligenceMark({ label = "SegmiQ analysis" }: { label?: string }) {
  return (
    <View style={styles.analysisHead}>
      <View style={styles.qMark}>
        <Text style={styles.qMarkText}>Q</Text>
      </View>
      <Text style={styles.analysisKicker}>{label}</Text>
    </View>
  );
}

function CoverMotif() {
  return (
    <View style={{ position: "absolute", right: 36, bottom: 64, width: 168, height: 168 }}>
      <Svg width={168} height={168}>
        <Circle cx="78" cy="72" r="44" stroke={LIME} strokeWidth="0.9" fill="none" />
        <Circle cx="78" cy="72" r="3.2" fill={INK} />
        <Line x1="78" y1="28" x2="78" y2="14" stroke={LIME} strokeWidth="0.8" />
        <Line x1="78" y1="116" x2="122" y2="148" stroke={LIME} strokeWidth="0.9" />
        <Circle cx="78" cy="14" r="2.2" fill={LIME} />
        <Circle cx="122" cy="148" r="2.4" fill={INK} />
        <Circle cx="132" cy="56" r="2" fill={LIME} />
        <Line x1="120" y1="72" x2="132" y2="56" stroke={LIME} strokeWidth="0.7" />
        <Circle cx="28" cy="96" r="2" fill={LIME} />
        <Line x1="36" y1="88" x2="28" y2="96" stroke={LIME} strokeWidth="0.7" />
        <Path d="M54 40 L102 40 L102 104 L54 104 Z" stroke={LIME} strokeWidth="0.35" fill="none" />
      </Svg>
    </View>
  );
}

function GlanceStrip({
  metrics,
  currency,
  responseCoverage,
}: {
  metrics: ComparedMetric[];
  currency: string;
  responseCoverage: WeeklyReportPayload["responseCoverage"];
}) {
  const leads = metricById(metrics, "new_leads");
  const won = metricById(metrics, "deals_won");
  const revenue = metricById(metrics, "revenue_won");
  const response = metricById(metrics, "avg_first_response");
  const cells = [
    { value: leads ? formatMetricValue(leads, currency) : "0", label: "Leads" },
    { value: won ? formatMetricValue(won, currency) : "0", label: Number(won?.current) === 1 ? "Deal won" : "Deals won" },
    { value: revenue ? formatMetricValue(revenue, currency) : formatReportMoney(0, currency), label: "Revenue" },
    {
      value: response ? formatMetricValue(response, currency) : formatMinutes(responseCoverage.contactedAverageMinutes),
      label: "Avg response",
    },
  ];
  return (
    <View style={styles.glance} wrap={false}>
      {cells.map((cell) => (
        <View key={cell.label} style={styles.glanceCell}>
          <Text style={styles.glanceValue}>{cell.value}</Text>
          <Text style={styles.glanceLabel}>{cell.label}</Text>
        </View>
      ))}
    </View>
  );
}

function InsightBlock({
  label,
  text,
  accent,
}: {
  label: string;
  text: string;
  accent: string;
}) {
  return (
    <View style={[styles.insight, { borderLeftWidth: 2.5, borderLeftColor: accent }]} wrap={false}>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

function FunnelStageRow({
  stage,
  maxCount,
  previous,
}: {
  stage: FunnelStageResult;
  maxCount: number;
  previous: FunnelStageResult | null;
}) {
  const width = stage.count <= 0 ? 10 : Math.max(18, Math.min(100, (stage.count / Math.max(maxCount, 1)) * 100));
  const fill = stage.bottleneck ? LIME : INK;
  return (
    <View wrap={false} style={{ marginBottom: 7 }}>
      {previous && stage.sequential ? (
        <View style={{ width: 1.5, height: 8, backgroundColor: stage.bottleneck ? LIME : LINE, marginVertical: 2, marginLeft: 8 }} />
      ) : null}
      {!stage.sequential ? (
        <Text style={{ fontSize: 7.5, color: MUTED, marginBottom: 4, letterSpacing: 0.4, textTransform: "uppercase" }}>
          Won during reporting period
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
        <Text style={{ fontSize: 9.5, fontWeight: 700 }}>{stage.label}</Text>
        <Text style={{ fontSize: 9.5 }}>
          {stage.count}
          {stage.sequential && stage.id !== "new_leads" ? `   ${formatPct(stage.conversionPct)}` : stage.id === "new_leads" ? "   100%" : ""}
          {stage.sequential && stage.dropOff > 0 ? `   Drop-off: ${stage.dropOff}` : ""}
        </Text>
      </View>
      <View style={{ height: 7, backgroundColor: WARM2, width: "100%" }}>
        <View
          style={{
            height: 7,
            width: `${width}%`,
            backgroundColor: fill,
          }}
        />
      </View>
    </View>
  );
}

function AttentionRow({ item, currency }: { item: AttentionItem; currency: string }) {
  const accent =
    item.priorityTag === "Reply Today" ? LIME : item.priorityTag === "High Value" || item.priorityTag === "Stalled" ? WARNING : INK;
  const meta = [
    item.priorityTag,
    item.salespersonName ?? "Unassigned",
    item.stageLabel,
    item.daysInactive && item.daysInactive > 0 ? formatDays(item.daysInactive) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <View style={[styles.attentionRow, { borderLeftColor: accent }]} wrap={false}>
      <View style={styles.attentionTop}>
        <Text style={styles.attentionName}>{item.displayName}</Text>
        <Text style={styles.attentionValue}>{item.value != null ? formatReportMoney(item.value, currency) : ""}</Text>
      </View>
      <Text style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{meta}</Text>
      <Text style={{ fontSize: 9, lineHeight: 1.3, marginTop: 3 }}>{item.reason}</Text>
      <Text style={{ fontSize: 9, lineHeight: 1.3, marginTop: 2, color: MUTED }}>
        Recommended  ·  {item.recommendedAction}
      </Text>
    </View>
  );
}

function PersonBlock({ person, currency }: { person: SalespersonNarrative; currency: string }) {
  const leads = personMetric(person.metrics, "leads_assigned");
  const quotes = personMetric(person.metrics, "quotations_sent");
  const wins = personMetric(person.metrics, "deals_won");
  const revenue = personMetric(person.metrics, "revenue_won");
  const response = personMetric(person.metrics, "avg_response");
  const stale = personMetric(person.metrics, "stale");
  const stats = [
    { label: "Leads", value: leads ? formatMetricValue(leads, currency) : "0" },
    { label: "Quotes", value: quotes ? formatMetricValue(quotes, currency) : "0" },
    { label: "Wins", value: wins ? formatMetricValue(wins, currency) : "0" },
    { label: "Revenue", value: revenue ? formatMetricValue(revenue, currency) : formatReportMoney(0, currency) },
    { label: "Response", value: response ? formatMetricValue(response, currency) : "n/a" },
    { label: "Quiet", value: stale ? formatMetricValue(stale, currency) : "0" },
  ];
  return (
    <View style={styles.person} wrap={false}>
      <Text style={styles.personName}>{person.name}</Text>
      <View style={styles.personStats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.personStat}>
            <Text style={{ fontSize: 10, fontWeight: 700 }}>{stat.value}</Text>
            <Text style={{ fontSize: 7, color: MUTED, marginTop: 1 }}>{stat.label}</Text>
          </View>
        ))}
      </View>
      {person.narrative ? (
        <>
          <Text style={styles.fieldLabel}>SegmiQ observation</Text>
          <Text style={{ fontSize: 9, lineHeight: 1.4, marginBottom: 4 }}>{person.narrative}</Text>
        </>
      ) : null}
      {person.coachingFocus ? (
        <>
          <Text style={styles.fieldLabel}>Coaching focus</Text>
          <Text style={{ fontSize: 9, lineHeight: 1.4 }}>{person.coachingFocus}</Text>
        </>
      ) : null}
    </View>
  );
}

function ThemeRow({ row }: { row: ConversationPattern }) {
  return (
    <View wrap={false} style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: LINE }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 10, fontWeight: 700, width: "58%" }}>{row.label}</Text>
        <Text style={{ fontSize: 9, width: "22%" }}>{countLabel(row.count, "conversation")}</Text>
        <Text style={{ fontSize: 7.5, color: MUTED, textAlign: "right", width: "20%", letterSpacing: 0.3 }}>
          {row.reliability}
        </Text>
      </View>
      <Text style={{ fontSize: 9, color: MUTED, marginTop: 3, lineHeight: 1.35 }}>{row.interpretation}</Text>
    </View>
  );
}

export function WeeklyTeamReportDocument({
  payload,
  logoDataUri,
}: {
  payload: WeeklyReportPayload;
  logoDataUri: string | null;
}) {
  const { cover, ai, metrics, funnel, salespeople, attention, lostDeals, conversation, pipelineHealth, responseCoverage } =
    payload;
  const periodForHeader = compactHeaderPeriod(cover.periodLabel);
  const titleLines = splitCoverTitle(cover.title);
  const highlightIds = [
    "new_leads",
    "deals_won",
    "revenue_won",
    "avg_first_response",
    "follow_ups_missed",
    "quotations_sent",
  ];
  const highlight = highlightIds.map((id) => metricById(metrics, id)).filter(Boolean) as ComparedMetric[];
  const pipelineTotal = pipelineHealth.reduce((sum, bucket) => sum + bucket.value, 0);
  const sequentialFunnel = funnel.filter((stage) => stage.sequential);
  const wonStage = funnel.find((stage) => stage.id === "won");
  const maxFunnel = Math.max(...sequentialFunnel.map((s) => s.count), 1);
  const riskBucket = [...pipelineHealth].sort((a, b) => b.pct - a.pct).find((b) => b.id !== "healthy" && b.pct >= 40);
  const bottleneck = funnel.find((stage) => stage.bottleneck);
  const bottleneckFrom = bottleneck ? funnel[Math.max(0, funnel.findIndex((s) => s.id === bottleneck.id) - 1)] : null;
  const showResponseNote =
    responseCoverage.missedSla > 0 &&
    responseCoverage.contactedAverageMinutes != null &&
    responseCoverage.newLeads > 0;
  const showQuotedFollowUp = pipelineHealth.some((b) => b.id === "quoted_awaiting_followup" && b.count > 0);

  return (
    <Document title={`${cover.title} · ${cover.periodLabel}`} author="SegmiQ Intelligence">
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.limeRail} />
        <CoverMotif />
        <View style={styles.coverBrand}>
          {logoDataUri ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is not HTML; org name sits beside it
            <Image style={styles.logo} src={logoDataUri} />
          ) : null}
          <View>
            <Text style={styles.orgName}>{cover.organisationName}</Text>
            <Text style={styles.kicker}>SegmiQ Intelligence</Text>
          </View>
        </View>
        {titleLines.map((line) => (
          <Text key={line} style={styles.coverTitle}>
            {line}
          </Text>
        ))}
        <View style={styles.titleRule} />
        <Text style={styles.periodLabel}>Reporting period</Text>
        <Text style={styles.periodValue}>{cover.periodLabel}</Text>
        <Text style={styles.generated}>Generated {cover.generatedAtLabel}</Text>
        {cover.timezone ? <Text style={styles.timezone}>{cover.timezone}</Text> : null}
        <View style={{ marginTop: 36, width: 280 }}>
          <Text style={{ fontSize: 7.5, color: MUTED, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>
            In this report
          </Text>
          {[
            "Executive summary",
            "Team performance and sales funnel",
            "Pipeline health",
            "Needs management attention",
            "Sales team and customer intelligence",
            "Recommended actions and next-week priorities",
          ].map((line) => (
            <View key={line} style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
              <View style={{ width: 10, height: 1.5, backgroundColor: LIME, marginRight: 10 }} />
              <Text style={{ fontSize: 10.5, lineHeight: 1.3 }}>{line}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.prepared}>{cover.preparedBy}</Text>
        {payload.lowData && ai.dataSufficiencyNote ? (
          <View style={[styles.factBox, { marginTop: 12 }]}>
            <Text style={{ fontSize: 9, lineHeight: 1.4 }}>{ai.dataSufficiencyNote}</Text>
          </View>
        ) : null}
        <CoverFooter org={cover.organisationName} />
      </Page>

      <Page size="A4" style={styles.page} bookmark="Executive Summary">
        <Header org={cover.organisationName} period={periodForHeader} />
        <Footer org={cover.organisationName} />
        <SectionTitle>Executive Summary</SectionTitle>
        <Text style={styles.p}>{ai.executiveSummary}</Text>
        <GlanceStrip metrics={metrics} currency={cover.currency} responseCoverage={responseCoverage} />
        <View style={styles.insightGrid}>
          <InsightBlock label="What went well" text={ai.whatWentWell} accent={LIME} />
          <InsightBlock label="Where momentum was lost" text={ai.whereMomentumWasLost} accent={INK} />
          <InsightBlock label="Biggest risk" text={ai.biggestRisk} accent={WARNING} />
          <InsightBlock label="Priority for next week" text={ai.priorityForNextWeek} accent={INK} />
        </View>
        {showResponseNote ? (
          <View style={styles.factBox} wrap={false}>
            <Text style={styles.factLabel}>Fact</Text>
            <Text style={{ fontSize: 9.5, lineHeight: 1.4, marginBottom: 6 }}>
              Average response time among contacted leads: {formatMinutes(responseCoverage.contactedAverageMinutes)}. {responseCoverage.missedSla} of {responseCoverage.newLeads} new leads did not receive a response inside the {responseCoverage.slaHours}-hour target.
            </Text>
            <IntelligenceMark label="SegmiQ observation" />
            <Text style={{ fontSize: 9.5, lineHeight: 1.4 }}>
              The average covers leads that received a response. Lead-response coverage may still need review despite the low average among those contacted.
            </Text>
          </View>
        ) : null}
      </Page>

      <Page size="A4" style={styles.page} wrap bookmark="Performance">
        <Header org={cover.organisationName} period={periodForHeader} />
        <Footer org={cover.organisationName} />
        <SectionTitle>Team Performance</SectionTitle>
        <View wrap={false}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: "34%" }]}>Metric</Text>
            <Text style={[styles.th, { width: "18%", textAlign: "right" }]}>This week</Text>
            <Text style={[styles.th, { width: "48%", paddingLeft: 12 }]}>Compared with last week</Text>
          </View>
          {highlight.map((metric, i) => {
            const comparison = metricComparison(metric);
            return (
              <View key={metric.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.cell, { width: "34%" }]}>{metric.label}</Text>
                <Text style={[styles.num, { width: "18%" }]}>{formatMetricValue(metric, cover.currency)}</Text>
                <View style={{ width: "48%", paddingLeft: 12 }}>
                  <Text style={{ fontSize: 9, color: toneColor(comparison.tone) }}>{comparison.text}</Text>
                  {comparison.qualifier && !comparison.text.toLowerCase().includes(comparison.qualifier.toLowerCase()) ? (
                    <Text style={{ fontSize: 7.5, color: toneColor(comparison.tone), marginTop: 1 }}>{comparison.qualifier}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ marginTop: 16 }} />
        <SectionTitle>Sales Funnel</SectionTitle>
        {funnel.map((stage, index) => (
          <FunnelStageRow
            key={stage.id}
            stage={stage}
            maxCount={maxFunnel}
            previous={index > 0 ? funnel[index - 1]! : null}
          />
        ))}
        {wonStage?.note ? (
          <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 2, marginBottom: 6 }}>{wonStage.note}</Text>
        ) : null}
        {bottleneck && bottleneckFrom ? (
          <View style={styles.analysis} wrap={false}>
            <IntelligenceMark />
            <Text style={{ fontSize: 8, color: MUTED, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 3 }}>
              Largest drop-off
            </Text>
            <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
              {bottleneckFrom.label} to {bottleneck.label}
            </Text>
            <Text style={{ fontSize: 9.5, lineHeight: 1.4 }}>
              {countLabel(bottleneck.dropOff, "opportunity")} did not progress.
            </Text>
            {payload.funnelExplanation
              .filter((insight) => !/won during reporting period/i.test(insight.text) && !/largest drop-off/i.test(insight.text))
              .slice(0, 2)
              .map((insight, i) => (
                <Text key={i} style={{ fontSize: 9.5, lineHeight: 1.4, marginTop: 4 }}>
                  {insight.kind === "interpretation" ? "SegmiQ observation. " : ""}
                  {insight.text}
                </Text>
              ))}
          </View>
        ) : null}
      </Page>

      <Page size="A4" style={[styles.page, { paddingTop: 58 }]} wrap bookmark="Pipeline Health">
        <Header org={cover.organisationName} period={periodForHeader} />
        <Footer org={cover.organisationName} />
        <Text
          fixed
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: FONT,
          }}
          render={(info) => {
            const sub = (info as { subPageNumber?: number }).subPageNumber;
            return sub && sub > 1 ? "Needs Management Attention — continued" : "";
          }}
        />
        <View wrap={false}>
          <SectionTitle>Pipeline Health</SectionTitle>
          <Text style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            {formatReportMoney(pipelineTotal, cover.currency)} active pipeline
          </Text>
          <View style={{ flexDirection: "row", height: 14, backgroundColor: WARM2, marginBottom: 8 }}>
            {pipelineHealth.map((bucket) => {
              if (bucket.pct <= 0 && bucket.count <= 0 && bucket.value <= 0) return null;
              const width = Math.max(bucket.pct, bucket.count > 0 ? 0.8 : 0);
              if (width <= 0) return null;
              return (
                <View
                  key={bucket.id}
                  style={{
                    width: `${width}%`,
                    backgroundColor: PIPELINE_COLORS[bucket.id] ?? INK,
                  }}
                />
              );
            })}
          </View>
          <View style={styles.legend}>
            {pipelineHealth
              .filter((bucket) => bucket.count > 0)
              .filter((bucket) => showQuotedFollowUp || bucket.id !== "quoted_awaiting_followup")
              .map((bucket) => (
                <View key={bucket.id} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: PIPELINE_COLORS[bucket.id] ?? INK }]} />
                  <View>
                    <Text style={{ fontSize: 9, fontWeight: 700 }}>{bucket.label}</Text>
                    <Text style={{ fontSize: 8, color: MUTED, marginTop: 1 }}>
                      {countLabel(bucket.count, "deal")}  ·  {formatReportMoney(bucket.value, cover.currency)}  ·  {formatPct(bucket.pct)}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
          {riskBucket ? (
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>
                {formatPct(riskBucket.pct)} of active pipeline is currently {riskBucket.label.toLowerCase()}.
              </Text>
              <Text style={{ fontSize: 9.5 }}>
                {formatReportMoney(riskBucket.value, cover.currency)} affected.
              </Text>
            </View>
          ) : null}
          {payload.pipelineHealthNarrative ? (
            <Text style={{ fontSize: 9.5, lineHeight: 1.4, marginBottom: 4 }}>{payload.pipelineHealthNarrative}</Text>
          ) : null}
        </View>

        <View bookmark="Needs Management Attention">
          <SectionTitle>Needs Management Attention</SectionTitle>
        </View>
        {attention.length === 0 ? (
          <View style={styles.empty} wrap={false}>
            <Text style={styles.emptyValue}>No major items this week</Text>
            <Text style={{ fontSize: 9.5, color: MUTED }}>No opportunities require management attention this week.</Text>
          </View>
        ) : (
          attention.map((item) => <AttentionRow key={item.id} item={item} currency={cover.currency} />)
        )}
      </Page>

      <Page size="A4" style={styles.page} wrap bookmark="Sales Team">
        <Header org={cover.organisationName} period={periodForHeader} />
        <Footer org={cover.organisationName} />
        <SectionTitle>Sales Team</SectionTitle>
        {salespeople.length === 0 ? (
          <Text style={styles.p}>{"No salespeople were in this organisation's team for the week."}</Text>
        ) : (
          salespeople.map((person) => <PersonBlock key={person.salespersonId} person={person} currency={cover.currency} />)
        )}

        <View style={{ marginTop: 8 }} bookmark="Customer Intelligence">
          <SectionTitle>What Customers Are Telling Your Team</SectionTitle>
        </View>
        {conversation.length === 0 ? (
          <View style={styles.empty} wrap={false}>
            <Text style={{ fontSize: 9.5, color: MUTED }}>
              No recurring conversation patterns were identified from authorised inbound messages.
            </Text>
          </View>
        ) : (
          conversation.map((row) => <ThemeRow key={row.id} row={row} />)
        )}

        <View style={{ marginTop: 12 }} bookmark="Lost Deals">
          <SectionTitle>Lost Deals</SectionTitle>
        </View>
        {lostDeals.count === 0 ? (
          <View style={styles.empty} wrap={false}>
            <Text style={styles.emptyValue}>0 recorded this week</Text>
            <Text style={{ fontSize: 9.5, color: MUTED }}>No opportunities were marked lost during this reporting period.</Text>
          </View>
        ) : (
          <View wrap={false}>
            <Text style={{ fontSize: 10, marginBottom: 8 }}>
              {countLabel(lostDeals.count, "lost deal")}  ·  {formatReportMoney(lostDeals.value, cover.currency)} potential revenue
            </Text>
            {lostDeals.reasonCounts.map((row) => (
              <Text key={row.reason} style={{ fontSize: 9.5, marginBottom: 4 }}>
                {row.reason}: {row.count}
              </Text>
            ))}
            {lostDeals.narrative ? (
              <View style={[styles.analysis, { marginTop: 8 }]}>
                <IntelligenceMark />
                <Text style={{ fontSize: 9.5, lineHeight: 1.4 }}>{lostDeals.narrative}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Page>

      <Page size="A4" style={styles.page} wrap bookmark="Recommended Actions">
        <Header org={cover.organisationName} period={periodForHeader} />
        <Footer org={cover.organisationName} />
        <SectionTitle>Recommended Actions</SectionTitle>
        {ai.managerRecommendations.length === 0 ? (
          <View style={styles.empty} wrap={false}>
            <Text style={{ fontSize: 9.5 }}>{"No additional management actions were required from this week's data."}</Text>
          </View>
        ) : (
          ai.managerRecommendations.map((row, i) => (
            <View key={i} style={styles.rec} wrap={false}>
              <Text style={styles.recNum}>{String(i + 1).padStart(2, "0")}</Text>
              <View style={styles.recBody}>
                <Text style={styles.recTitle}>{row.title}</Text>
                <Text style={styles.fieldLabel}>Evidence</Text>
                <Text style={{ fontSize: 9.5, lineHeight: 1.4, marginBottom: 3 }}>{row.evidence}</Text>
                <Text style={styles.fieldLabel}>Recommended action</Text>
                <Text style={{ fontSize: 9.5, lineHeight: 1.4, marginBottom: 3 }}>{row.action}</Text>
                <Text style={styles.fieldLabel}>Objective</Text>
                <Text style={{ fontSize: 9.5, lineHeight: 1.4, color: MUTED }}>{row.objective}</Text>
              </View>
            </View>
          ))
        )}

        <View style={{ marginTop: 10 }} bookmark="Priorities for Next Week">
          <SectionTitle>Priorities for Next Week</SectionTitle>
        </View>
        {ai.nextWeekPriorities.length === 0 ? (
          <Text style={styles.p}>Keep the current operating cadence and review high-value pipeline in the weekly meeting.</Text>
        ) : (
          ai.nextWeekPriorities.map((row, i) => (
            <View key={i} style={styles.priority} wrap={false}>
              <Text style={styles.recNum}>{String(i + 1).padStart(2, "0")}</Text>
              <View style={styles.recBody}>
                <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{row.title}</Text>
                <Text style={{ fontSize: 9.5, color: MUTED }}>
                  {row.summary
                    ? row.summary
                    : [
                        countLabel(row.affectedCount, "opportunity", "opportunities"),
                        row.pipelineValue ? `${formatReportMoney(row.pipelineValue, cover.currency)} affected` : "",
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                </Text>
              </View>
            </View>
          ))
        )}

        <View style={{ marginTop: 4 }} bookmark="Sales Meeting Agenda" wrap={false}>
          <SectionTitle>Monday Sales Meeting</SectionTitle>
          {ai.meetingAgenda.map((item, i) => (
            <View key={i} style={styles.agendaLine}>
              <Text style={styles.agendaNum}>{i + 1}.</Text>
              <Text style={{ fontSize: 10.5, lineHeight: 1.35 }}>{item}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

function compactHeaderPeriod(periodLabel: string): string {
  return periodLabel
    .replace("January", "Jan")
    .replace("February", "Feb")
    .replace("March", "Mar")
    .replace("April", "Apr")
    .replace("June", "Jun")
    .replace("July", "Jul")
    .replace("August", "Aug")
    .replace("September", "Sep")
    .replace("October", "Oct")
    .replace("November", "Nov")
    .replace("December", "Dec");
}
