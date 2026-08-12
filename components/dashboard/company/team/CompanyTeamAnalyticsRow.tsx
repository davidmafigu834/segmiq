"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Avatar, Badge } from "@/components/sales/ui";
import { GoalProgressRing } from "./GoalProgressRing";
import type {
  CompanyTeamCompositionSlice,
  CompanyTeamGoalCoverageBucket,
  CompanyTeamSupportPerson,
} from "./types";

function Donut({
  slices,
  centerValue,
  centerLabel,
}: {
  slices: Array<{ name: string; value: number; color: string }>;
  centerValue: string;
  centerLabel: string;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return (
      <div className="flex h-[120px] items-center justify-center text-[12px] text-sales-text-muted">
        No data yet
      </div>
    );
  }
  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="none"
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[18px] font-semibold tabular-nums leading-none text-sales-text-primary">
          {centerValue}
        </p>
        <p className="mt-0.5 text-[10px] text-sales-text-muted">{centerLabel}</p>
      </div>
    </div>
  );
}

export function CompanyTeamAnalyticsRow({
  composition,
  compositionTotal,
  teamAvgPct,
  coverageBuckets,
  needingSupport,
  onSelectMember,
  onViewSupport,
  onViewComposition,
}: {
  composition: CompanyTeamCompositionSlice[];
  compositionTotal: number;
  teamAvgPct: number | null;
  coverageBuckets: CompanyTeamGoalCoverageBucket[];
  needingSupport: CompanyTeamSupportPerson[];
  onSelectMember: (id: string) => void;
  onViewSupport: () => void;
  onViewComposition: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 xl:gap-4">
      <section className="flex min-h-[190px] flex-col rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
        <p className="text-[13px] font-semibold text-sales-text-primary">Team composition</p>
        <div className="mt-3 flex flex-1 items-center gap-4">
          <Donut
            slices={composition.map((s) => ({ name: s.label, value: s.count, color: s.color }))}
            centerValue={String(compositionTotal)}
            centerLabel="Total"
          />
          <ul className="min-w-0 flex-1 space-y-2">
            {composition.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-[12px]">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: s.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sales-text-secondary">{s.label}</span>
                <span className="tabular-nums text-sales-text-primary">
                  {s.count} ({s.pct}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="mt-3 text-left text-[12px] font-medium text-sales-brand-fg hover:underline"
          onClick={onViewComposition}
        >
          View full breakdown →
        </button>
      </section>

      <section className="flex min-h-[190px] flex-col rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
        <p className="text-[13px] font-semibold text-sales-text-primary">Goal coverage</p>
        <div className="mt-3 flex flex-1 items-center gap-4">
          {teamAvgPct != null ? (
            <GoalProgressRing pct={teamAvgPct} size={88} />
          ) : (
            <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-dashed border-sales-border text-[11px] text-sales-text-muted">
              —
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-sales-text-muted">Team avg.</p>
            <p className="text-[18px] font-semibold tabular-nums text-sales-text-primary">
              {teamAvgPct != null ? `${teamAvgPct}%` : "—"}
            </p>
            <ul className="mt-2 space-y-1">
              {coverageBuckets.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-[11px]">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: b.color }} />
                  <span className="flex-1 text-sales-text-secondary">{b.label}</span>
                  <span className="tabular-nums text-sales-text-primary">{b.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Link
          href="/client/reports"
          className="mt-3 text-[12px] font-medium text-sales-brand-fg hover:underline"
        >
          View Goal report →
        </Link>
      </section>

      <section className="flex min-h-[190px] flex-col rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card md:col-span-2 xl:col-span-1">
        <p className="text-[13px] font-semibold text-sales-text-primary">People needing support</p>
        {needingSupport.length === 0 ? (
          <p className="mt-6 text-[12px] text-sales-text-muted">
            No one needs coaching attention right now.
          </p>
        ) : (
          <ul className="mt-3 flex-1 space-y-2.5">
            {needingSupport.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 text-left hover:opacity-90"
                  onClick={() => onSelectMember(p.id)}
                >
                  <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-sales-text-primary">
                      {p.name}
                    </p>
                    <p className="truncate text-[11px] text-sales-text-muted">{p.reason}</p>
                  </div>
                  <Badge tone={p.attention === "needs_attention" ? "warning" : "warning"}>
                    {p.attentionLabel}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="mt-3 text-left text-[12px] font-medium text-sales-brand-fg hover:underline"
          onClick={onViewSupport}
        >
          View all →
        </button>
      </section>
    </div>
  );
}
