import type { CompanyBrainSnapshot } from "./types";

const TTL_MS = 60_000;
const cache = new Map<string, { expires: number; snapshot: CompanyBrainSnapshot }>();

export function getCachedBrain(clientId: string): CompanyBrainSnapshot | null {
  const hit = cache.get(clientId);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(clientId);
    return null;
  }
  return hit.snapshot;
}

export function setCachedBrain(clientId: string, snapshot: CompanyBrainSnapshot): void {
  cache.set(clientId, { expires: Date.now() + TTL_MS, snapshot });
}

export function invalidateBrainCache(clientId: string): void {
  cache.delete(clientId);
}
