import { overlapScore } from "@/lib/documents/classification/matching";

export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 12);
}

export function toFtsQuery(query: string): string | null {
  const tokens = tokenizeQuery(query);
  if (!tokens.length) return null;
  return tokens.join(" & ");
}

export function scoreChunkOverlap(query: string, content: string): number {
  return overlapScore(query, content);
}

export function lifecycleRankBoost(status: string): number {
  switch (status) {
    case "SIGNED":
      return 0.18;
    case "ACTIVE":
      return 0.14;
    case "FINAL":
      return 0.1;
    case "UNDER_REVIEW":
      return 0.04;
    case "DRAFT":
      return -0.06;
    case "EXPIRED":
    case "TERMINATED":
    case "SUPERSEDED":
      return -0.04;
    default:
      return 0;
  }
}

export function processingRankBoost(status: string): number {
  if (status === "READY") return 0.05;
  if (status === "NEEDS_REVIEW") return 0.02;
  if (status === "FAILED") return -0.08;
  return 0;
}

export function metadataMatchScore(
  query: string,
  opts: { title: string; originalFileName: string; entityLabels?: string[] }
): number {
  const titleScore = overlapScore(query, opts.title);
  const fileScore = overlapScore(query, opts.originalFileName) * 0.85;
  const entityScore = Math.max(
    0,
    ...(opts.entityLabels ?? []).map((label) => overlapScore(query, label))
  );
  return Math.max(titleScore * 0.95, fileScore, entityScore * 0.9);
}

export function fuseSearchScore(opts: {
  metadataScore: number;
  lexicalScore: number;
  overlapScore: number;
  lifecycleStatus: string;
  processingStatus: string;
  isCurrentVersion: boolean;
}): number {
  const content = Math.max(opts.lexicalScore * 0.55, opts.overlapScore * 0.45);
  const metadata = opts.metadataScore * 0.35;
  const fused = metadata + content;
  return (
    fused +
    lifecycleRankBoost(opts.lifecycleStatus) +
    processingRankBoost(opts.processingStatus) +
    (opts.isCurrentVersion ? 0.08 : -0.12)
  );
}

export function buildSnippet(content: string, maxLen = 220): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1)}…`;
}
