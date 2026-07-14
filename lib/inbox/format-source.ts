import { SOURCE_LABELS } from "@/lib/inbox/scoring";

export function formatSource(source: string | null): string {
  if (!source) return "Unknown";
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}
