import type { ClientTeamOverviewRow, RecentLeadRow } from "@/lib/dashboard-data";
import { WinInsightsSection } from "@/components/dashboard/WinInsightsSection";
import { ClientIntelligenceOverview } from "@/components/intelligence/ClientIntelligenceOverview";
import { AudienceSummaryCard } from "@/components/intelligence/AudienceSummaryCard";
import { PerformanceTrends } from "@/components/intelligence/PerformanceTrends";
import { ClientRecommendations } from "@/components/intelligence/ClientRecommendations";
import { EmptyNote, Fact, Panel, QuietRow, WorkRow } from "@/components/platform/workbench";

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
    isSolo?: boolean;
  };
  isAgencyAdmin: boolean;
}) {
  const base = `/dashboard/clients/${clientId}`;
  const fbIntegrationActive = Boolean(fbPageName?.trim() || fbPageId);
  const latest = recentLeads[0];
  const fact = !onboarding.fbConnected
    ? { name: "Facebook is not connected.", detail: "Connect the page before leads can arrive from Meta.", action: "Open integrations", href: `${base}/facebook` }
    : !onboarding.hasManager && !onboarding.isSolo
      ? { name: "No manager is on this organisation.", detail: "Add the person who runs the account.", action: "Open users", href: `${base}/team` }
      : onboarding.formFieldCount === 0
        ? { name: "The lead form has no fields.", detail: "The public form cannot collect a lead until a field is added.", action: "Open form", href: `${base}/form` }
        : !profilePublished
          ? { name: "The profile page is not published.", detail: "Publish it when the organisation should be visible.", action: "Open profile", href: `${base}/profile` }
          : latest
            ? { name: `${latest.name?.trim() || "A lead"} just came in.`, detail: `${latest.source} · ${latest.status}. Open the lead list to work it.`, action: "Open leads", href: "/dashboard/leads" }
            : { name: `${clientName} has nothing waiting.`, detail: "Open users when someone needs access.", action: "Open users", href: `${base}/team` };

  return (
    <div className="space-y-8">
      <Fact name={fact.name} detail={fact.detail} action={fact.action} href={fact.href} />
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <Panel title="Recent leads" count={recentLeads.length}>
          {recentLeads.length === 0 ? (
            <EmptyNote title="No recent leads" detail="New leads for this organisation show up here." />
          ) : (
            <ul>
              {recentLeads.slice(0, 6).map((lead) => (
                <WorkRow
                  key={lead.id}
                  name={lead.name?.trim() || "Unnamed lead"}
                  meta={lead.source}
                  detail={lead.status}
                  mark="waiting"
                  action="Open"
                  href="/dashboard/leads"
                />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="People" count={team.length}>
          {team.length === 0 ? (
            <EmptyNote title="No users yet" detail="Add the manager or the sales team from Users." />
          ) : (
            <ul>
              {team.slice(0, 6).map((person) => (
                <QuietRow
                  key={person.id}
                  name={person.name}
                  detail={`${person.role} · ${person.is_active ? "Active" : "Inactive"}`}
                  action="Open"
                  href={`${base}/team`}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Setup">
        <ul>
          <QuietRow name="Profile page" detail={profilePublished ? profilePublicUrl || "Published" : "Not published"} action="Open" href={`${base}/profile`} />
          <QuietRow name="Facebook" detail={fbIntegrationActive ? fbPageName?.trim() || "Page linked" : "Not connected"} action="Open" href={`${base}/facebook`} />
          <QuietRow name="Notifications" detail={notificationsConfigured ? "WhatsApp and email are on" : "WhatsApp or email is not finished"} action="Open" href={`${base}/settings?tab=notifications`} />
        </ul>
      </Panel>

      <WinInsightsSection clientId={clientId} />
      <ClientIntelligenceOverview clientId={clientId} />
      <AudienceSummaryCard clientId={clientId} />
      <PerformanceTrends clientId={clientId} />
      <ClientRecommendations clientId={clientId} isAgencyAdmin={isAgencyAdmin} />
    </div>
  );
}
