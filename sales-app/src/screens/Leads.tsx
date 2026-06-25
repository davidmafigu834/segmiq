import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { OfflineBanner } from "../components/OfflineBanner";
import { ScreenHeader } from "../components/ScreenHeader";
import { TabBar, type TabId } from "../components/TabBar";
import { LeadRowCard } from "../components/LeadRowCard";
import { useOnline } from "../hooks/useOnline";
import { fetchLeads } from "../lib/leads";
import { leadDisplayName } from "../lib/format";
import { classifyLeadLane } from "../lib/lead-lanes";
import type { LeadRow } from "../lib/types";

type Props = {
  userName: string;
  onTabChange: (tab: TabId) => void;
  onOpenLead: (lead: LeadRow) => void;
  onLogCall: (leadId?: string, channel?: "call" | "whatsapp") => void;
  followUpBadge: number;
  syncBadge: number;
};

export function Leads({
  userName,
  onTabChange,
  onOpenLead,
  onLogCall,
  followUpBadge,
  syncBadge,
}: Props) {
  const online = useOnline();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchLeads();
      setLeads(rows.filter((l) => !["WON", "LOST", "NOT_QUALIFIED"].includes(l.status)));
    } catch {
      /* cached */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const hay = [
        l.name,
        l.phone,
        l.email,
        l.project_type,
        l.budget,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, query]);

  const grouped = useMemo(() => {
    const now = new Date();
    const pinned: LeadRow[] = [];
    const rest: LeadRow[] = [];
    for (const lead of filtered) {
      const { lane } = classifyLeadLane(lead, now);
      if (lane === "call_now" || lane === "follow_ups") pinned.push(lead);
      else rest.push(lead);
    }
    const sortByName = (a: LeadRow, b: LeadRow) =>
      leadDisplayName(a.name).localeCompare(leadDisplayName(b.name));
    pinned.sort(sortByName);
    rest.sort(sortByName);
    return { pinned, rest };
  }, [filtered]);

  return (
    <div className="flex min-h-full flex-col bg-bg-primary pb-28">
      {!online ? <OfflineBanner /> : null}
      <ScreenHeader
        eyebrow="Pipeline"
        title="Leads"
        subtitle={`${leads.length} active`}
      />

      <div className="px-5 pt-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, project…"
            className="w-full rounded-lg border border-border bg-bg-secondary py-3.5 pl-10 pr-4 text-[16px] text-ink-primary outline-none focus:border-border-focus"
          />
        </div>

        {loading && leads.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-tertiary" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-ink-tertiary">No leads found</p>
        ) : (
          <div className="space-y-6 pb-4">
            {grouped.pinned.length > 0 ? (
              <section>
                <p className="eyebrow mb-2">Priority</p>
                <div className="space-y-2">
                  {grouped.pinned.map((lead) => (
                    <LeadRowCard
                      key={lead.id}
                      lead={lead}
                      repName={userName}
                      onOpen={onOpenLead}
                      onLogCall={(l, ch) => onLogCall(l.id, ch)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <p className="eyebrow mb-2">All leads</p>
              <div className="space-y-2">
                {grouped.rest.map((lead) => (
                  <LeadRowCard
                    key={lead.id}
                    lead={lead}
                    repName={userName}
                    onOpen={onOpenLead}
                    onLogCall={(l, ch) => onLogCall(l.id, ch)}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <TabBar
        active="leads"
        onChange={onTabChange}
        followUpBadge={followUpBadge}
        syncBadge={syncBadge}
      />
    </div>
  );
}
