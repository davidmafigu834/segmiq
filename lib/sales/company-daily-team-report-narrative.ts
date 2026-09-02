import type { CompanyDailyTeamMemberRow, CompanyDailyTeamReport } from "@/components/dashboard/company/types";

export type DailyReportDayTone = "strong" | "attention" | "quiet" | "on_track";

export type DailyTeamNarrativeLabels = {
  leadSingular: string;
  leadPlural: string;
  dealSingular: string;
  dealPlural: string;
  showQuotes: boolean;
};

function pluralWord(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${pluralWord(count, singular, plural)}`;
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "This team member";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function contactRate(contacted: number, newLeads: number): number | null {
  if (newLeads <= 0) return null;
  return Math.round((contacted / newLeads) * 100);
}

export function assessDailyReportDay(
  row: CompanyDailyTeamMemberRow,
  showQuotes: boolean
): { tone: DailyReportDayTone; label: string } {
  if (
    row.dealsWon >= 2 ||
    (row.dealsWon > 0 && row.qualified >= 2 && row.contacted >= row.newLeads * 0.6)
  ) {
    return { tone: "strong", label: "Strong day" };
  }

  const hasPendingQuote = showQuotes && row.quotesPrepared > 0 && row.quotesSent === 0;
  const lowContact =
    row.newLeads >= 3 && row.contacted < Math.ceil(row.newLeads * 0.5);
  if (row.followUpsDue > 0 || hasPendingQuote || lowContact) {
    return { tone: "attention", label: "Needs attention" };
  }

  const active =
    row.newLeads +
      row.qualified +
      row.contacted +
      row.quotesPrepared +
      row.quotesSent +
      row.dealsWon +
      row.followUpsDue >
    0;

  if (!active) {
    return { tone: "quiet", label: "Quiet day" };
  }

  return { tone: "on_track", label: "On track" };
}

export function buildTeamDailySummaryNarrative(
  report: CompanyDailyTeamReport,
  labels: DailyTeamNarrativeLabels
): string {
  const { totals } = report;
  const parts: string[] = [];

  if (totals.newLeads > 0) {
    parts.push(
      `The team received ${countLabel(totals.newLeads, labels.leadSingular.toLowerCase(), labels.leadPlural.toLowerCase())} today`
    );
  } else {
    parts.push(`No new ${labels.leadPlural.toLowerCase()} came in today`);
  }

  if (totals.contacted > 0 || totals.qualified > 0) {
    const contactBits: string[] = [];
    if (totals.contacted > 0) {
      contactBits.push(`${totals.contacted} contacted`);
    }
    if (totals.qualified > 0) {
      contactBits.push(`${totals.qualified} qualified`);
    }
    parts.push(contactBits.join(" and "));
  }

  if (labels.showQuotes) {
    if (totals.quotesPrepared > 0 || totals.quotesSent > 0) {
      const quoteBits: string[] = [];
      if (totals.quotesPrepared > 0) {
        quoteBits.push(
          `${countLabel(totals.quotesPrepared, "quote prepared", "quotes prepared")}`
        );
      }
      if (totals.quotesSent > 0) {
        quoteBits.push(`${countLabel(totals.quotesSent, "quote sent", "quotes sent")}`);
      } else if (totals.quotesPrepared > 0) {
        quoteBits.push("none sent yet");
      }
      parts.push(quoteBits.join(", "));
    }
  }

  if (totals.dealsWon > 0) {
    parts.push(
      `${countLabel(totals.dealsWon, labels.dealSingular.toLowerCase(), labels.dealPlural.toLowerCase())} closed`
    );
  }

  if (totals.followUpsDue > 0) {
    parts.push(
      `${countLabel(totals.followUpsDue, "follow-up due", "follow-ups due")} across the team`
    );
  }

  return `${parts.join(". ")}.`.replace(/\.\./g, ".");
}

export function buildSalespersonDailyNarrative(
  row: CompanyDailyTeamMemberRow,
  report: CompanyDailyTeamReport,
  labels: DailyTeamNarrativeLabels
): string {
  const name = firstName(row.name);
  const { totals } = report;
  const sentences: string[] = [];

  if (row.newLeads > 0) {
    const leadPhrase = countLabel(
      row.newLeads,
      labels.leadSingular.toLowerCase(),
      labels.leadPlural.toLowerCase()
    );
    const isTopInbound = row.newLeads === Math.max(...report.rows.map((r) => r.newLeads));
    const share =
      totals.newLeads > 0 ? Math.round((row.newLeads / totals.newLeads) * 100) : null;

    if (isTopInbound && report.rows.length > 1 && row.newLeads > 0) {
      sentences.push(
        `${name} handled the heaviest inbound load today with ${leadPhrase} assigned (${share}% of the team total).`
      );
    } else {
      sentences.push(`${name} received ${leadPhrase} today.`);
    }
  } else {
    sentences.push(`${name} had no new ${labels.leadPlural.toLowerCase()} assigned today.`);
  }

  if (row.newLeads > 0 && row.contacted > 0) {
    const rate = contactRate(row.contacted, row.newLeads);
    sentences.push(
      `Contact was made on ${countLabel(row.contacted, "lead", "leads")}${rate != null ? ` (${rate}% of today's assigned load)` : ""}.`
    );
  } else if (row.newLeads > 0 && row.contacted === 0) {
    sentences.push(
      `None of today's assigned ${labels.leadPlural.toLowerCase()} have been contacted yet.`
    );
  }

  if (row.qualified > 0) {
    sentences.push(
      `${countLabel(row.qualified, "lead", "leads")} ${row.qualified === 1 ? "was" : "were"} qualified for the pipeline.`
    );
  }

  if (labels.showQuotes) {
    if (row.quotesPrepared > 0 && row.quotesSent === 0) {
      sentences.push(
        `${countLabel(row.quotesPrepared, "quote was", "quotes were")} prepared but not sent to the customer yet.`
      );
    } else if (row.quotesPrepared > 0 && row.quotesSent > 0) {
      sentences.push(
        `${countLabel(row.quotesSent, "quote was", "quotes were")} sent after preparation today.`
      );
    } else if (row.quotesPrepared === 0 && row.newLeads > 0) {
      sentences.push("No quotes were prepared today.");
    }
  }

  if (row.dealsWon > 0) {
    const isTopCloser = row.dealsWon === Math.max(...report.rows.map((r) => r.dealsWon));
    const dealPhrase = countLabel(
      row.dealsWon,
      labels.dealSingular.toLowerCase(),
      labels.dealPlural.toLowerCase()
    );
    if (isTopCloser && report.rows.filter((r) => r.dealsWon > 0).length > 1) {
      sentences.push(`${name} closed ${dealPhrase} — the most on the team today.`);
    } else {
      sentences.push(`${name} closed ${dealPhrase} today.`);
    }
  }

  if (row.followUpsDue > 0) {
    sentences.push(
      `${countLabel(row.followUpsDue, "follow-up is", "follow-ups are")} due and should be cleared before end of day.`
    );
  } else if (
    row.newLeads +
      row.qualified +
      row.contacted +
      row.quotesPrepared +
      row.quotesSent +
      row.dealsWon ===
    0
  ) {
    sentences.push("No sales activity was recorded for today.");
  }

  return sentences.join(" ");
}
