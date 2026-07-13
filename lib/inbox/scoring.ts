import { computeRulesScore, type RankableLead } from "@/lib/lead-lanes";
import type { InboxScoreBreakdown } from "./types";

const URGENCY_POINTS: Record<string, number> = {
  immediate: 25,
  soon: 18,
  planning: 10,
  exploring: 3,
  unknown: 0,
};

const BUDGET_POINTS: Record<string, number> = {
  confirmed: 25,
  indicated: 12,
  unknown: 0,
};

const SPECIFICITY_POINTS: Record<string, number> = {
  high: 20,
  medium: 12,
  low: 5,
  unknown: 0,
};

export const SCORE_HOT_MIN = 70;
export const SCORE_WARM_MIN = 45;

export function scoreLabel(score: number): "Hot" | "Warm" | "Cold" {
  if (score >= SCORE_HOT_MIN) return "Hot";
  if (score >= SCORE_WARM_MIN) return "Warm";
  return "Cold";
}

export function scoreColor(score: number): string {
  if (score >= SCORE_HOT_MIN) return "var(--accent)";
  if (score >= SCORE_WARM_MIN) return "var(--warning)";
  return "var(--text-tertiary)";
}

export function scoreIntentTitle(label: "Hot" | "Warm" | "Cold", score: number): string {
  return `${label} lead · intent score ${score} (${label === "Hot" ? `≥${SCORE_HOT_MIN}` : label === "Warm" ? `${SCORE_WARM_MIN}–${SCORE_HOT_MIN - 1}` : `<${SCORE_WARM_MIN}`})`;
}

export function scoreIntentStyles(
  label: "Hot" | "Warm" | "Cold",
  variant: "list" | "header" | "default" = "list"
): { bg: string; text: string; border: string; dot: string } {
  if (variant === "header") {
    if (label === "Hot") {
      return { bg: "rgba(255,244,229,0.28)", text: "#FFF4E5", border: "rgba(255,244,229,0.35)", dot: "#FB923C" };
    }
    if (label === "Warm") {
      return { bg: "rgba(255,255,255,0.18)", text: "#FEF3C7", border: "rgba(255,255,255,0.25)", dot: "#FBBF24" };
    }
    return { bg: "rgba(255,255,255,0.14)", text: "#E2E8F0", border: "rgba(255,255,255,0.2)", dot: "#94A3B8" };
  }

  if (variant === "default") {
    if (label === "Hot") {
      return { bg: "rgba(212,255,79,0.12)", text: "var(--accent)", border: "rgba(212,255,79,0.3)", dot: "var(--accent)" };
    }
    if (label === "Warm") {
      return { bg: "rgba(245,166,35,0.12)", text: "var(--warning)", border: "rgba(245,166,35,0.3)", dot: "var(--warning)" };
    }
    return { bg: "rgba(255,255,255,0.06)", text: "var(--text-tertiary)", border: "var(--border)", dot: "var(--text-tertiary)" };
  }

  if (label === "Hot") {
    return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA", dot: "#EF4444" };
  }
  if (label === "Warm") {
    return { bg: "#FFF4E5", text: "#C2410C", border: "#FED7AA", dot: "#F97316" };
  }
  return { bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0", dot: "#94A3B8" };
}

export function effectiveInboxScore(lead: {
  score?: number | null;
  aiScore?: number | null;
  aiEnabled?: boolean;
} & RankableLead): number {
  if (lead.aiEnabled && typeof lead.aiScore === "number") return lead.aiScore;
  if (typeof lead.score === "number" && lead.score > 0) return lead.score;
  return computeRulesScore(lead).score;
}

export function breakdownFromIntelligence(intel: {
  urgency_level?: string | null;
  budget_confidence?: string | null;
  location_extracted?: string | null;
  project_specificity?: string | null;
  intent_category?: string | null;
} | null, engagementBreakdown?: Record<string, number> | null): InboxScoreBreakdown {
  const urgency = URGENCY_POINTS[intel?.urgency_level ?? "unknown"] ?? 0;
  const budget = BUDGET_POINTS[intel?.budget_confidence ?? "unknown"] ?? 0;
  const location = intel?.location_extracted?.trim() ? 15 : 0;
  let productInterest = SPECIFICITY_POINTS[intel?.project_specificity ?? "unknown"] ?? 0;
  if (intel?.intent_category && intel.intent_category !== "unknown") {
    productInterest = Math.min(20, productInterest + 5);
  }

  const eb = engagementBreakdown ?? {};
  const recency = eb.recency ?? 0;
  const calls = eb.calls ?? 0;
  const assets = eb.assets_sent ?? 0;
  const engagement = Math.min(15, Math.round((recency / 20) * 5 + (calls / 20) * 5 + (assets / 15) * 5));

  return { urgency, budget, location, productInterest, engagement };
}

export function breakdownFromRules(lead: RankableLead): InboxScoreBreakdown {
  const rules = computeRulesScore(lead);
  const urgency = Math.min(25, Math.round(rules.score * 0.2));
  const budget = Math.min(25, Math.round(rules.score * 0.25));
  const location = leadLocationHint(lead) ? 12 : 0;
  const productInterest = Math.min(20, Math.round(rules.score * 0.18));
  const engagement = Math.min(15, Math.round(rules.score * 0.12));
  return { urgency, budget, location, productInterest, engagement };
}

function leadLocationHint(lead: RankableLead): boolean {
  const fd = lead.form_data ?? {};
  return Object.keys(fd).some((k) => /location|city|area|region|state/i.test(k));
}

export const STAGE_LABELS: Record<string, string> = {
  NEW: "New Lead",
  CONTACTED: "Contacted",
  NEGOTIATING: "Quoted",
  PROPOSAL_SENT: "Quoted",
  WON: "Won",
  LOST: "Lost",
  NOT_QUALIFIED: "Lost",
};

export function stageLabel(status: string, followUpDate: string | null): string {
  if (followUpDate) {
    const due = new Date(followUpDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (due <= today) return "Follow-up Due";
  }
  return STAGE_LABELS[status] ?? status.replace(/_/g, " ");
}

export function stageStyle(status: string, followUpDate: string | null): {
  bg: string;
  text: string;
  border: string;
} {
  const label = stageLabel(status, followUpDate);
  const map: Record<string, { bg: string; text: string; border: string }> = {
    "New Lead": { bg: "rgba(212,255,79,0.12)", text: "var(--accent)", border: "rgba(212,255,79,0.3)" },
    Contacted: { bg: "rgba(255,255,255,0.06)", text: "var(--text-secondary)", border: "var(--border)" },
    Quoted: { bg: "rgba(245,166,35,0.12)", text: "var(--warning)", border: "rgba(245,166,35,0.3)" },
    "Follow-up Due": { bg: "rgba(245,166,35,0.12)", text: "var(--warning)", border: "rgba(245,166,35,0.3)" },
    Won: { bg: "rgba(61,214,140,0.12)", text: "var(--success)", border: "rgba(61,214,140,0.3)" },
    Lost: { bg: "rgba(255,68,68,0.12)", text: "var(--error)", border: "rgba(255,68,68,0.3)" },
  };
  return map[label] ?? map.Contacted;
}

export const SOURCE_LABELS: Record<string, string> = {
  LANDING_PAGE: "Website",
  FACEBOOK: "Facebook",
  MANUAL: "Manual",
  REFERRAL: "Referral",
  WHATSAPP_INBOUND: "WhatsApp",
};
