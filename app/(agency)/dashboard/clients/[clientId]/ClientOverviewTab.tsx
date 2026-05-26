import type { ReactNode } from "react";
import Link from "next/link";
import { Inbox, ArrowRight } from "lucide-react";
import { RecentLeadsTable } from "@/components/dashboard/RecentLeadsTable";
import { ClientAvatar } from "@/components/ClientAvatar";
import { OnboardingChecklist } from "@/components/client/OnboardingChecklist";
import type { ClientTeamOverviewRow, RecentLeadRow } from "@/lib/dashboard-data";
import { WinInsightsSection } from "@/components/dashboard/WinInsightsSection";
import { ClientIntelligenceOverview } from "@/components/intelligence/ClientIntelligenceOverview";
import { AudienceSummaryCard } from "@/components/intelligence/AudienceSummaryCard";
import { PerformanceTrends } from "@/components/intelligence/PerformanceTrends";
import { ClientRecommendations } from "@/components/intelligence/ClientRecommendations";

export function ClientOverviewTab({
  clientId,
  clientName,
  recentLeads,
  team,
  profilePublished,
  profilePublicUrl,
  fbPageName,
  fbPageId,
  notificationsConfigured,
  onboarding,
  isAgencyAdmin,
}: {
  clientId: string;
  clientName: string;
  recentLeads: RecentLeadRow[];
  team: ClientTeamOverviewRow[];
  profilePublished: boolean;
  profilePublicUrl: string | null;
  fbPageName: string | null;
  fbPageId: string | null;
  notificationsConfigured: boolean;
  onboarding: {
    formFieldCount: number;
    salespeopleCount: number;
    hasManager: boolean;
    fbConnected: boolean;
  };
  isAgencyAdmin: boolean;
}) {
  const fbIntegrationActive = Boolean(fbPageName?.trim() || fbPageId);

  return (
    <div className="space-y-12">
      <OnboardingChecklist
        client={{
          id: clientId,
          name: clientName,
          profilePublished,
          formFieldCount: onboarding.formFieldCount,
          salespeopleCount: onboarding.salespeopleCount,
          hasManager: onboarding.hasManager,
          fbConnected: onboarding.fbConnected,
        }}
      />
      <div className="flex flex-col gap-8 min-[1100px]:max-h-[min(72dvh,calc(100dvh-15rem))] min-[1100px]:min-h-0 min-[1100px]:flex-row min-[1100px]:items-stretch">
        <section className="min-h-0 min-w-0 min-[1100px]:flex-[1.6] min-[1100px]:overflow-y-auto min-[1100px]:overflow-x-hidden min-[1100px]:pr-2 min-[1100px]:overscroll-contain">
          <RecentLeadsTable
            rows={recentLeads}
            eyebrow="01 / RECENT ACTIVITY"
            title="Recent leads"
            showSourceFilters={false}
          />
        </section>

        <section className="min-h-0 min-w-0 min-[1100px]:flex-1 min-[1100px]:overflow-y-auto min-[1100px]:overflow-x-hidden min-[1100px]:overscroll-contain">
          <div className="mb-5">
            <p className="font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-ink-tertiary">02 / TEAM</p>
            <h2 className="mt-1 font-display text-2xl tracking-display text-ink-primary">Sales team</h2>
          </div>
          {team.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-border px-4 py-10 text-center">
              <Inbox className="h-8 w-8 text-ink-tertiary" strokeWidth={1.25} aria-hidden />
              <p className="text-[14px] text-ink-secondary">No salespeople added</p>
              <Link
                href={`/dashboard/clients/${clientId}/team`}
                className="text-[13px] font-medium text-ink-primary underline underline-offset-4 hover:text-ink-secondary"
              >
                Open Team tab
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-[10px] border border-border bg-surface-card">
              {team.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <ClientAvatar name={u.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ink-primary">{u.name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink-tertiary">
                      {u.role} · {u.email}
                    </div>
                  </div>
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${u.is_active ? "bg-[var(--success)]" : "bg-ink-tertiary"}`}
                      title={u.is_active ? "Active" : "Inactive"}
                    />
                    <span className="font-mono text-[11px] tabular-nums text-ink-secondary">{u.leadsThisWeek} leads</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <div className="mb-5">
          <p className="font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-ink-tertiary">03 / CONNECTIONS</p>
          <h2 className="mt-1 font-display text-[22px] tracking-display text-ink-primary">Integrations</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <IntegrationCard
            label="Profile page"
            statusDotClass={profilePublished ? "bg-[var(--success)]" : "bg-ink-tertiary"}
            statusText={
              profilePublished && profilePublicUrl ? (
                <span className="truncate">{profilePublicUrl}</span>
              ) : (
                <span className="text-ink-secondary">Not published</span>
              )
            }
            href={`/dashboard/clients/${clientId}/profile`}
            linkLabel="Manage →"
          />
          <IntegrationCard
            label="Facebook"
            statusDotClass={fbIntegrationActive ? "bg-[var(--success)]" : "bg-ink-tertiary"}
            statusText={
              fbIntegrationActive ? (
                <span className="truncate">{fbPageName?.trim() || "Page linked"}</span>
              ) : (
                <span className="text-ink-secondary">Not connected</span>
              )
            }
            href={`/dashboard/clients/${clientId}/facebook`}
            linkLabel={fbIntegrationActive ? "View →" : "Configure →"}
          />
          <IntegrationCard
            label="Notifications"
            statusDotClass={notificationsConfigured ? "bg-[var(--success)]" : "bg-amber-500"}
            statusText={
              notificationsConfigured ? (
                <span>WhatsApp + Email active</span>
              ) : (
                <span className="text-amber-700">Complete Twilio &amp; Resend in agency settings</span>
              )
            }
            href={`/dashboard/clients/${clientId}/settings?tab=notifications`}
            linkLabel="Settings →"
          />
        </div>
      </section>

      <WinInsightsSection clientId={clientId} />
      <ClientIntelligenceOverview clientId={clientId} />
      <AudienceSummaryCard clientId={clientId} />
      <PerformanceTrends clientId={clientId} />
      <ClientRecommendations clientId={clientId} isAgencyAdmin={isAgencyAdmin} />
    </div>
  );
}

function IntegrationCard({
  label,
  statusDotClass,
  statusText,
  href,
  linkLabel,
}: {
  label: string;
  statusDotClass: string;
  statusText: ReactNode;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-card p-5">
      <p className="font-mono text-[10px] font-normal uppercase tracking-[0.08em] text-ink-tertiary">{label}</p>
      <div className="mt-3 flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusDotClass}`} />
        <div className="min-w-0 flex-1 text-[13px] text-ink-primary">{statusText}</div>
      </div>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink-secondary hover:text-ink-primary">
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
