"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target, X, Bell } from "lucide-react";
import {
  RETARGETING_PROGRESS_SHOW_RATIO,
  canNudgeRetargeting,
  retargetingStatusLabel,
  type RetargetingStatusView,
} from "@/lib/retargeting-shared";

function isDismissed(status: RetargetingStatusView): boolean {
  if (!status.bannerDismissedUntil) return false;
  return new Date(status.bannerDismissedUntil) > new Date();
}

function shouldShowBanner(status: RetargetingStatusView): boolean {
  if (status.status === "ad_live") return false;
  if (isDismissed(status)) return false;
  if (status.status === "building") {
    return status.leadCount >= status.threshold * RETARGETING_PROGRESS_SHOW_RATIO;
  }
  return status.status === "ready" || status.status === "ad_pending";
}

export function RetargetingBanners({
  statuses,
}: {
  statuses: RetargetingStatusView[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [nudging, setNudging] = useState<string | null>(null);

  const visible = statuses.filter(
    (s) => shouldShowBanner(s) && !hidden.has(s.clientId)
  );

  if (visible.length === 0) return null;

  async function dismiss(clientId: string) {
    await fetch("/api/sales/retargeting/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    setHidden((prev) => new Set(prev).add(clientId));
  }

  async function nudge(clientId: string) {
    setNudging(clientId);
    try {
      const res = await fetch("/api/sales/retargeting/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setNudging(null);
    }
  }

  return (
    <div className="ag-fade-in flex flex-col gap-2 mb-6">
      {visible.map((s) => {
        const showNudge =
          (s.status === "ready" || s.status === "ad_pending") &&
          canNudgeRetargeting(s.lastNudgeAt);
        const progressPct = Math.min(
          100,
          Math.round((s.leadCount / s.threshold) * 100)
        );

        return (
          <div
            key={s.clientId}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Target
                  size={18}
                  className="shrink-0 mt-0.5 text-[var(--accent)]"
                />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                    Retargeting audience — {s.clientName}
                  </p>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {retargetingStatusLabel(s.status)} · {s.leadCount} leads
                    {s.status === "building" &&
                      ` — retargeting audience opens at ${s.threshold}`}
                  </p>
                  {s.status === "building" && (
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                      {s.leadCount} leads collected — retargeting audience opens
                      soon ({progressPct}%)
                    </p>
                  )}
                  {s.status === "ready" && (
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                      Audience is ready for Meta export. Your agency will build
                      the retargeting ad.
                    </p>
                  )}
                  {s.status === "ad_pending" && (
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                      Exported to Meta — waiting for the ad to go live.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(s.clientId)}
                className="shrink-0 w-7 h-7 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>

            {showNudge && (
              <button
                type="button"
                disabled={nudging === s.clientId}
                onClick={() => nudge(s.clientId)}
                className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Bell size={14} />
                {nudging === s.clientId ? "Sending…" : "Nudge agency"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
