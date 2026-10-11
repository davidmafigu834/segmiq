/** Per-user dashboard visit boundary. Reloads keep the same window. */

export const DASHBOARD_VISIT_GAP_MS = 15 * 60 * 1000;

export type StoredDashboardVisit = {
  sinceAt: string | null;
  visitId: string;
  visitStartedAt: string;
  updatedAt: string;
};

export type ResolvedDashboardVisit = {
  sameVisit: boolean;
  /** Events after this instant belong to the current window. Null means no prior visit. */
  sinceAt: string | null;
  reliableAwayWindow: boolean;
  visitId: string;
  visitStartedAt: string;
  updatedAt: string;
};

export function resolveDashboardVisit(opts: {
  stored: StoredDashboardVisit | null;
  incomingVisitId: string | null;
  now: Date;
  nextVisitId: string;
  gapMs?: number;
}): ResolvedDashboardVisit {
  const nowIso = opts.now.toISOString();
  const gap = opts.gapMs ?? DASHBOARD_VISIT_GAP_MS;
  const stored = opts.stored;

  if (!stored) {
    return {
      sameVisit: false,
      sinceAt: null,
      reliableAwayWindow: false,
      visitId: opts.nextVisitId,
      visitStartedAt: nowIso,
      updatedAt: nowIso,
    };
  }

  const idle = opts.now.getTime() - new Date(stored.updatedAt).getTime();
  const sameToken = opts.incomingVisitId != null && opts.incomingVisitId === stored.visitId;
  const sameSitting = sameToken || idle < gap;
  if (sameSitting) {
    return {
      sameVisit: true,
      sinceAt: stored.sinceAt,
      reliableAwayWindow: stored.sinceAt != null,
      visitId: stored.visitId,
      visitStartedAt: stored.visitStartedAt,
      updatedAt: nowIso,
    };
  }

  return {
    sameVisit: false,
    sinceAt: stored.visitStartedAt,
    reliableAwayWindow: true,
    visitId: opts.nextVisitId,
    visitStartedAt: nowIso,
    updatedAt: nowIso,
  };
}
