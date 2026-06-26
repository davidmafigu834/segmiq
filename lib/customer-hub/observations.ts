export type ObservationType = "red" | "amber" | "green";

export type HubObservation = {
  type: ObservationType;
  text: string;
  filter_key: string;
};

type ObservationMeta = {
  walk_in_no_logs: number;
  whatsapp_saved_avg_days: number;
  whatsapp_inbound_avg_hours: number;
  out_of_budget_single: number;
  referral_converted_pct: number;
  facebook_converted_pct: number;
  never_contacted: number;
};

export function buildObservations(meta: ObservationMeta): HubObservation[] {
  const out: HubObservation[] = [];

  if (meta.walk_in_no_logs > 3) {
    out.push({
      type: "red",
      text: `${meta.walk_in_no_logs} walk-ins this month have no call log. They physically came to you and left — no one followed up in the system.`,
      filter_key: "walk_in_no_logs",
    });
  }

  if (
    meta.whatsapp_saved_avg_days > 0 &&
    meta.whatsapp_inbound_avg_hours >= 0 &&
    meta.whatsapp_saved_avg_days > meta.whatsapp_inbound_avg_hours * 3
  ) {
    out.push({
      type: "amber",
      text: `WhatsApp saved contacts average ${meta.whatsapp_saved_avg_days} days before first follow-up. WhatsApp inbound contacts average ${meta.whatsapp_inbound_avg_hours} hours. Same channel, opposite behavior.`,
      filter_key: "whatsapp_saved_slow",
    });
  }

  if (meta.out_of_budget_single > 5) {
    out.push({
      type: "amber",
      text: `${meta.out_of_budget_single} contacts were logged out of budget after only one call. Budget objections on first contact are rarely final.`,
      filter_key: "out_of_budget_single",
    });
  }

  if (
    meta.facebook_converted_pct > 0 &&
    meta.referral_converted_pct > meta.facebook_converted_pct * 2
  ) {
    const mult = Math.round(meta.referral_converted_pct / meta.facebook_converted_pct);
    out.push({
      type: "green",
      text: `Referral contacts convert at ${meta.referral_converted_pct}% — ${mult}× higher than Facebook leads. Ask every won customer to refer one person.`,
      filter_key: "referral_high_convert",
    });
  }

  if (meta.never_contacted > 20) {
    out.push({
      type: "red",
      text: `${meta.never_contacted} contacts across all sources have never been contacted. That is pipeline sitting completely untouched.`,
      filter_key: "never_contacted",
    });
  }

  const priority: Record<ObservationType, number> = { red: 0, amber: 1, green: 2 };
  return out.sort((a, b) => priority[a.type] - priority[b.type]).slice(0, 5);
}
