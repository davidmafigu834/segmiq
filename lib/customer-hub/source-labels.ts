/** Normalized contact source keys used by the Customer Hub dashboard. */
export type NormalizedSource =
  | "walk_in"
  | "whatsapp_inbound"
  | "whatsapp_saved"
  | "facebook"
  | "referral"
  | "other";

export const SOURCE_DISPLAY: Record<
  NormalizedSource,
  { label: string; dotColor: string }
> = {
  walk_in: { label: "Walk-in", dotColor: "#D4FF4F" },
  whatsapp_inbound: { label: "WhatsApp inbound", dotColor: "#25D366" },
  whatsapp_saved: { label: "WhatsApp saved", dotColor: "#128C7E" },
  facebook: { label: "Facebook", dotColor: "#1877F2" },
  referral: { label: "Referral", dotColor: "#a78bfa" },
  other: { label: "Other", dotColor: "#888888" },
};

export const KNOWN_SOURCES: NormalizedSource[] = [
  "walk_in",
  "whatsapp_inbound",
  "whatsapp_saved",
  "facebook",
  "referral",
  "other",
];

export function healthLabel(health: string): string {
  if (health === "healthy") return "Healthy";
  if (health === "needs_attention") return "Needs attention";
  return "At risk";
}

export function healthClass(health: string): string {
  if (health === "healthy") return "text-[var(--success)] bg-[rgba(61,214,140,0.12)]";
  if (health === "needs_attention") return "text-[var(--warning)] bg-[rgba(245,166,35,0.12)]";
  return "text-[var(--error)] bg-[rgba(255,68,68,0.12)]";
}

export function recentStatusLabel(status: string): string {
  if (status === "follow_up_due") return "Follow-up due";
  if (status === "quoted") return "Quoted";
  if (status === "won") return "Won";
  return "No contact yet";
}

export function recentStatusClass(status: string): string {
  if (status === "follow_up_due") return "text-[var(--warning)] bg-[rgba(245,166,35,0.12)]";
  if (status === "quoted") return "text-[var(--accent)] bg-[rgba(212,255,79,0.12)]";
  if (status === "won") return "text-[var(--success)] bg-[rgba(61,214,140,0.12)]";
  return "text-[var(--error)] bg-[rgba(255,68,68,0.12)]";
}
