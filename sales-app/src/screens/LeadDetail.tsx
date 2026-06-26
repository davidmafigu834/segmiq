import { useEffect, useState } from "react";
import { ChevronLeft, ClipboardList, MessageCircle, Phone } from "lucide-react";
import { apiGet } from "../lib/api";
import { CrmButton } from "../components/crm";
import { LeadDetailsTab } from "../components/LeadDetailsTab";
import { LeadQuotations } from "../components/LeadQuotations";
import { LeadSendPanel } from "../components/LeadSendPanel";
import { leadDisplayName, statusLabel, timeAgo } from "../lib/format";
import { fetchLead } from "../lib/leads";
import type { LeadRow, TimelineEvent } from "../lib/types";
import { buildOpenerMessage, dialPhone, openWhatsApp } from "../lib/whatsapp";

type DetailTab = "details" | "timeline" | "quotes" | "send";

type Props = {
  leadId: string;
  userName: string;
  online: boolean;
  logRefreshKey?: number;
  onBack: () => void;
  onLogCall: (leadId: string, channel?: "call" | "whatsapp") => void;
};

export function LeadDetail({ leadId, userName, online, logRefreshKey = 0, onBack, onLogCall }: Props) {
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tab, setTab] = useState<DetailTab>("details");
  const [loading, setLoading] = useState(true);
  const [localLogRefreshKey, setLocalLogRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [l, t] = await Promise.all([
          fetchLead(leadId),
          apiGet<{ events?: TimelineEvent[] }>(`/api/leads/${leadId}/timeline`),
        ]);
        if (!mounted) return;
        setLead(l);
        setTimeline(t.data.events ?? []);
      } catch {
        if (mounted) setLead(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [leadId]);

  useEffect(() => {
    if (logRefreshKey === 0) return;
    let mounted = true;
    void fetchLead(leadId).then((l) => {
      if (mounted) setLead(l);
    });
    return () => {
      mounted = false;
    };
  }, [leadId, logRefreshKey]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg-primary">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-full flex-col bg-bg-primary p-5 safe-top">
        <button type="button" onClick={onBack} className="mb-4 flex items-center gap-2 text-accent">
          <ChevronLeft size={20} /> Back
        </button>
        <p className="text-ink-secondary">Lead not found</p>
      </div>
    );
  }

  const name = leadDisplayName(lead.name);
  const firstName = name.split(/\s+/)[0] ?? name;
  const companyName = lead.clients?.name ?? undefined;

  function handleLeadUpdated(updated: LeadRow) {
    setLead(updated);
    setLocalLogRefreshKey((k) => k + 1);
  }

  const combinedLogRefreshKey = logRefreshKey + localLogRefreshKey;

  return (
    <div className="flex min-h-full flex-col bg-bg-primary pb-28 safe-top">
      <div className="border-b border-border px-5 pb-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[14px] font-medium text-accent"
        >
          <ChevronLeft size={18} /> Back
        </button>
        <h1 className="font-display text-3xl text-ink-primary">{name}</h1>
        <p className="mt-1 text-[14px] text-ink-tertiary">{statusLabel(lead.status)}</p>
      </div>

      <div className="flex overflow-x-auto border-b border-border px-5 scrollbar-hide">
        {(
          [
            { id: "details", label: "Details" },
            { id: "timeline", label: "Timeline" },
            { id: "quotes", label: "Quotes" },
            { id: "send", label: "Send" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[48px] shrink-0 flex-1 border-b-2 px-2 text-[13px] font-semibold transition-colors ${
              tab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-ink-tertiary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === "details" ? (
          <LeadDetailsTab
            lead={lead}
            online={online}
            logRefreshKey={combinedLogRefreshKey}
            onLeadUpdated={handleLeadUpdated}
            onLogCall={() => onLogCall(lead.id)}
            onOpenSendTab={() => setTab("send")}
          />
        ) : tab === "timeline" ? (
          <div className="space-y-3">
            {timeline.length === 0 ? (
              <p className="py-8 text-center text-[14px] text-ink-tertiary">No activity yet</p>
            ) : (
              timeline
                .slice()
                .reverse()
                .map((ev) => (
                  <div key={ev.id} className="rounded-xl border border-border bg-surface-card p-4">
                    <p className="text-[14px] font-medium text-ink-primary">
                      {ev.event_type.replace(/_/g, " ").toLowerCase()}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-tertiary">
                      {ev.actor_name ?? "System"} · {timeAgo(ev.created_at)}
                    </p>
                  </div>
                ))
            )}
          </div>
        ) : tab === "quotes" ? (
          <LeadQuotations leadId={leadId} clientId={lead.client_id} leadPhone={lead.phone} />
        ) : (
          <LeadSendPanel leadId={leadId} clientId={lead.client_id} leadPhone={lead.phone} />
        )}
      </div>

      <div
        className="safe-bottom fixed inset-x-0 bottom-0 flex gap-2 border-t border-border bg-bg-primary px-3 py-3"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <CrmButton
          variant="secondary"
          className="flex-1 min-w-0 px-2"
          onClick={() => {
            if (dialPhone(lead.phone)) onLogCall(lead.id, "call");
          }}
        >
          <Phone size={18} /> Call
        </CrmButton>
        <CrmButton
          className="flex-1 min-w-0 px-2"
          onClick={() => {
            const msg = buildOpenerMessage({
              leadFirstName: firstName,
              repName: userName,
              companyName,
            });
            if (openWhatsApp(lead.phone, msg)) onLogCall(lead.id, "whatsapp");
          }}
        >
          <MessageCircle size={18} /> WhatsApp
        </CrmButton>
        <CrmButton
          variant="secondary"
          className="flex-1 min-w-0 px-2"
          onClick={() => onLogCall(lead.id)}
        >
          <ClipboardList size={18} /> Log
        </CrmButton>
      </div>
    </div>
  );
}
