import type { AttentionSnapshot } from "./types";

export function attentionReply(snapshot: AttentionSnapshot): string {
  const n = snapshot.groups.reduce((s, g) => s + g.count, 0);
  if (n === 0) {
    return "No urgent issues detected. Pipeline, quotations, and conversations look clear right now.";
  }
  const lines = [`You have ${n} item${n === 1 ? "" : "s"} that need attention.`, ""];
  snapshot.groups.forEach((g, i) => {
    const sample = snapshot.items.find((it) => it.type === g.type);
    lines.push(`${i + 1}. ${g.label} — ${g.count}`);
    if (sample) {
      lines.push(
        `   ${sample.title}${sample.valueLabel ? ` · ${sample.valueLabel}` : ""}${sample.waitingLabel ? ` · ${sample.waitingLabel}` : ""}`
      );
    }
  });
  const first = snapshot.groups[0];
  if (first?.type === "QUOTE_APPROVAL") {
    lines.push("", "Suggested next step: review pending quotation approvals first.");
  }
  return lines.join("\n");
}
