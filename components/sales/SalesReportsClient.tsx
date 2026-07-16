"use client";



import { useEffect, useState } from "react";

import Link from "next/link";

import { BarChart3, CalendarClock, Flame, Loader2, Phone, Trophy } from "lucide-react";

import { WhatsAppHubReportSection } from "@/components/reports/WhatsAppHubReportSection";

import type { WhatsAppHubPeriod, WhatsAppHubReport } from "@/lib/whatsapp-hub-report";
import { EmptyState, SegmentedTabs } from "@/components/ui";



type ReportNumbers = {

  totalActive: number;

  callNow: number;

  calledToday: number;

  followUpToday: number;

  slipped: number;

  convertLaterCount: number;

  wonThisMonth: number;

};



type DashboardPayload = {

  numbers?: ReportNumbers;

  mirror?: { line?: string };

};



function StatCard({

  label,

  value,

  hint,

  href,

  icon: Icon,

}: {

  label: string;

  value: number;

  hint?: string;

  href?: string;

  icon: typeof Flame;

}) {

  const content = (

    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-5 transition-colors hover:border-[var(--border-hover)]">

      <div className="mb-3 flex items-center gap-2 text-[var(--text-tertiary)]">

        <Icon className="h-4 w-4" strokeWidth={1.8} />

        <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</p>

      </div>

      <p className="font-mono text-[30px] font-semibold leading-none tabular-nums text-[var(--text-primary)]">{value}</p>

      {hint ? <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">{hint}</p> : null}

    </div>

  );



  if (!href) return content;



  return (

    <Link href={href} className="block transition-opacity hover:opacity-90">

      {content}

    </Link>

  );

}



export function SalesReportsClient() {

  const [loading, setLoading] = useState(true);

  const [numbers, setNumbers] = useState<ReportNumbers | null>(null);

  const [mirrorLine, setMirrorLine] = useState<string | null>(null);

  const [waPeriod, setWaPeriod] = useState<WhatsAppHubPeriod>("this_week");

  const [waReport, setWaReport] = useState<WhatsAppHubReport | null>(null);

  const [waLoading, setWaLoading] = useState(true);

  const [reportError, setReportError] = useState(false);



  useEffect(() => {

    fetch("/api/sales/dashboard")

      .then((res) => {
        if (!res.ok) throw new Error("Could not load sales report");
        return res.json();
      })

      .then((data: DashboardPayload) => {

        setNumbers(data.numbers ?? null);

        setMirrorLine(data.mirror?.line ?? null);

      })

      .catch(() => setReportError(true))

      .finally(() => setLoading(false));

  }, []);



  useEffect(() => {

    setWaLoading(true);

    fetch(`/api/reports/whatsapp-hub?period=${waPeriod}`)

      .then((res) => res.json())

      .then((data: WhatsAppHubReport) => setWaReport(data))

      .catch(() => setWaReport(null))

      .finally(() => setWaLoading(false));

  }, [waPeriod]);



  if (loading) {

    return (

      <div className="flex justify-center py-20">

        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-tertiary)]" />

      </div>

    );

  }



  if (!numbers) {

    return (

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)]">
        <EmptyState
          icon={BarChart3}
          title="Could not load your sales report"
          description={reportError ? "Refresh the page to try again." : "Report data is not available yet."}
        />
      </div>

    );

  }



  return (

    <div className="space-y-8">

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-5">

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--channel-whatsapp)]">

            WhatsApp Sales Hub reporting

          </p>

          <SegmentedTabs
            aria-label="Report period"
            value={waPeriod}
            onValueChange={(value) => setWaPeriod(value as WhatsAppHubPeriod)}
            tabs={[
              { value: "this_week", label: "This week" },
              { value: "this_month", label: "This month" },
            ]}
          />

        </div>

        {waLoading ? (

          <div className="flex justify-center py-12">

            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />

          </div>

        ) : waReport ? (

          <WhatsAppHubReportSection report={waReport} showTeamTable={false} inboxHref="/sales/inbox" />

        ) : (

          <p className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">

            No WhatsApp hub activity to report yet.

          </p>

        )}

      </div>



      {mirrorLine ? (

        <div className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] px-5 py-4">

          <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-fg)]">

            Performance insight

          </p>

          <p className="text-[14px] text-[var(--text-secondary)]">{mirrorLine}</p>

        </div>

      ) : null}



      <div>

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">

          Pipeline overview

        </p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

          <StatCard

            label="Hot leads"

            value={numbers.callNow}

            hint="Leads that need contact now"

            href="/sales/inbox/hot-leads"

            icon={Flame}

          />

          <StatCard

            label="Follow-ups today"

            value={numbers.followUpToday}

            hint="Scheduled for today"

            href="/sales/followups"

            icon={CalendarClock}

          />

          <StatCard

            label="Called today"

            value={numbers.calledToday}

            hint="Outbound activity logged today"

            icon={Phone}

          />

          <StatCard

            label="Active pipeline"

            value={numbers.totalActive}

            hint="Leads currently in play"

            href="/sales/leads"

            icon={BarChart3}

          />

          <StatCard

            label="Won this month"

            value={numbers.wonThisMonth}

            hint="Closed wins in the current month"

            href="/sales/won-lost"

            icon={Trophy}

          />

          <StatCard

            label="Slipped"

            value={numbers.slipped}

            hint="Leads that missed their follow-up window"

            icon={CalendarClock}

          />

        </div>

      </div>

    </div>

  );

}

