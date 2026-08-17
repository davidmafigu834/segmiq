"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings2, Target } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Progress,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import { formatDealCurrency } from "@/lib/sales/format";
import type { DailySalesPlanPayload } from "@/lib/sales/intelligence/types";
import { defaultOperatingHours } from "@/lib/sales/intelligence/operating-hours";
import { OperatingHoursFields } from "@/components/settings/OperatingHoursFields";
import { cn } from "@/lib/ui/cn";

export function GoalsIntelligenceSection() {
  const { toast } = useSalesToast();
  const [plan, setPlan] = useState<DailySalesPlanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prospects, setProspects] = useState("");
  const [calls, setCalls] = useState("");
  const [followups, setFollowups] = useState("");
  const [quotes, setQuotes] = useState("");
  const [workingDays, setWorkingDays] = useState<number[]>([...defaultOperatingHours().workingDays]);
  const [workStartTime, setWorkStartTime] = useState(defaultOperatingHours().workStartTime);
  const [workEndTime, setWorkEndTime] = useState(defaultOperatingHours().workEndTime);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, settingsRes] = await Promise.all([
        fetch("/api/sales/daily-plan"),
        fetch("/api/sales/execution-settings"),
      ]);
      if (planRes.ok) {
        setPlan((await planRes.json()) as DailySalesPlanPayload);
      } else {
        setPlan(null);
      }
      if (settingsRes.ok) {
        const json = (await settingsRes.json()) as {
          settings: {
            dailyProspectTarget: number | null;
            dailyCallTarget: number | null;
            dailyFollowupTarget: number | null;
            dailyQuoteTarget: number | null;
            workingDays: number[] | null;
            workStartTime: string | null;
            workEndTime: string | null;
          } | null;
        };
        const s = json.settings;
        const hours = defaultOperatingHours();
        setProspects(s?.dailyProspectTarget != null ? String(s.dailyProspectTarget) : "");
        setCalls(s?.dailyCallTarget != null ? String(s.dailyCallTarget) : "");
        setFollowups(s?.dailyFollowupTarget != null ? String(s.dailyFollowupTarget) : "");
        setQuotes(s?.dailyQuoteTarget != null ? String(s.dailyQuoteTarget) : "");
        setWorkingDays(s?.workingDays?.length ? s.workingDays : hours.workingDays);
        setWorkStartTime(s?.workStartTime?.slice(0, 5) || hours.workStartTime);
        setWorkEndTime(s?.workEndTime?.slice(0, 5) || hours.workEndTime);
      }
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    setSaving(true);
    try {
      const toNum = (v: string) => {
        const n = Number(v);
        return v.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : Math.floor(n);
      };
      const res = await fetch("/api/sales/execution-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "self",
          dailyProspectTarget: toNum(prospects),
          dailyCallTarget: toNum(calls),
          dailyFollowupTarget: toNum(followups),
          dailyQuoteTarget: toNum(quotes),
          workingDays,
          workStartTime,
          workEndTime,
        }),
      });
      if (!res.ok) throw new Error("fail");
      toast({ title: "Daily commitments saved", tone: "success" });
      setSettingsOpen(false);
      await load();
    } catch {
      toast({ title: "Couldn't save commitments", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !plan) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-36 rounded-sales-xl" />
        <Skeleton className="h-36 rounded-sales-xl" />
      </div>
    );
  }

  if (!plan) return null;

  const currency = plan.goal.currency ?? "USD";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-sales-brand-fg" aria-hidden />
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                Your current focus
              </p>
            </div>
            <h3 className="text-[18px] font-semibold text-sales-text-primary">{plan.focus.title}</h3>
            <p className="text-[13px] leading-relaxed text-sales-text-secondary">{plan.focus.body}</p>
            {plan.goal.dailyFocus?.headline || plan.goal.daysLeftLabel || plan.schedule ? (
              <p className="text-[12px] text-sales-text-muted">
                {[plan.goal.dailyFocus?.headline, plan.goal.daysLeftLabel, plan.schedule?.summary]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            <Link
              href="/sales/tasks"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-sales-brand-fg hover:underline"
            >
              Open today&apos;s plan <ChevronRight size={14} aria-hidden />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              Goal coverage
            </p>
            {plan.goal.remainingValue != null ? (
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="text-sales-text-muted">Remaining target</p>
                  <p className="mt-0.5 font-semibold text-sales-text-primary">
                    {formatDealCurrency(plan.goal.remainingValue, { currency })}
                  </p>
                </div>
                <div>
                  <p className="text-sales-text-muted">Days left</p>
                  <p className="mt-0.5 font-semibold text-sales-text-primary">
                    {plan.goal.daysLeftLabel ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sales-text-muted">Active pipeline</p>
                  <p className="mt-0.5 font-semibold text-sales-text-primary">
                    {plan.coverage.activePipelineValue != null
                      ? formatDealCurrency(plan.coverage.activePipelineValue, { currency })
                      : "Not set"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-sales-text-secondary">
                Set a sales goal to connect pipeline coverage to your target.
              </p>
            )}
            <p className="text-[14px] font-semibold text-sales-text-primary">
              {plan.coverage.coverageLabel}
            </p>
            <p className="text-[12px] leading-relaxed text-sales-text-secondary">
              {plan.coverage.interpretation}
            </p>
          </CardContent>
        </Card>
      </div>

      {plan.whatNeedsAttention.length > 0 ? (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              What needs attention
            </p>
            <ul className="mt-3 divide-y divide-sales-border-subtle">
              {plan.whatNeedsAttention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-sales-text-primary hover:text-sales-brand-fg"
                  >
                    <span>{item.text}</span>
                    <ChevronRight size={16} className="shrink-0 text-sales-text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              Today&apos;s commitments
            </p>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Settings2 size={14} strokeWidth={1.8} />}
              onClick={() => setSettingsOpen((v) => !v)}
            >
              Configure
            </Button>
          </div>

          {plan.progress.commitments.length === 0 ? (
            <p className="text-[13px] text-sales-text-secondary">
              No daily activity targets configured. Deal priorities still work from your leads and
              follow-ups.
            </p>
          ) : (
            <div className="space-y-3">
              {plan.progress.commitments.map((c) => {
                const pct =
                  c.target > 0 ? Math.min(100, Math.round((c.completed / c.target) * 100)) : 0;
                return (
                  <div key={c.kind} className="space-y-1.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-sales-text-secondary">{c.label}</span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          c.status === "completed"
                            ? "text-sales-success"
                            : "text-sales-text-primary"
                        )}
                      >
                        {c.completed} / {c.target}
                      </span>
                    </div>
                    <Progress value={pct} tone={c.status === "completed" ? "success" : "brand"} />
                  </div>
                );
              })}
            </div>
          )}

          {settingsOpen ? (
            <div className="space-y-3 rounded-[10px] border border-sales-border p-3">
              <p className="text-[12px] text-sales-text-secondary">
                Leave a field blank to disable that commitment. Targets are opt-in only.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["Prospects / day", prospects, setProspects],
                    ["Calls / day", calls, setCalls],
                    ["Follow-ups / day", followups, setFollowups],
                    ["Quotes / day", quotes, setQuotes],
                  ] as const
                ).map(([label, value, setter]) => (
                  <label key={label} className="block space-y-1">
                    <span className="text-[12px] font-medium text-sales-text-secondary">{label}</span>
                    <Input
                      inputMode="numeric"
                      value={value}
                      onChange={(e) => setter(e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="—"
                    />
                  </label>
                ))}
              </div>
              <OperatingHoursFields
                workingDays={workingDays}
                workStartTime={workStartTime}
                workEndTime={workEndTime}
                onWorkingDaysChange={setWorkingDays}
                onStartChange={setWorkStartTime}
                onEndChange={setWorkEndTime}
                hint="Your hours override the company schedule for goal days left and today’s plan."
              />
              <div className="flex gap-2">
                <Button variant="primary" size="sm" loading={saving} onClick={() => void saveSettings()}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
