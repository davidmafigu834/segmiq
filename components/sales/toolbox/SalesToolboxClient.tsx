"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  FilePlus2,
  Image,
  ListTodo,
  MessageSquareText,
  PhoneCall,
  UserRoundPlus,
} from "lucide-react";
import { AddToHubSheet } from "@/components/sales/AddToHubSheet";
import { QuickLogSheet } from "@/components/sales/QuickLogSheet";
import { AddEventSheet } from "@/components/sales/calendar/AddEventSheet";
import {
  CreateQuoteDialog,
  type QuotationWithItems,
} from "@/components/sales/quotes/CreateQuoteDialog";
import { QuotationBuilder } from "@/components/leads/QuotationBuilder";
import { ToolCard } from "@/components/sales/toolbox/ToolCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { toDateKey } from "@/lib/sales/calendar/format";
import { cn } from "@/lib/ui/cn";

const RECENT_KEY = "segmiq.sales.toolbox.recent";
const MAX_RECENT = 4;

type ToolId =
  | "add_lead"
  | "log_call"
  | "create_quote"
  | "schedule_follow_up"
  | "event_capture"
  | "follow_ups"
  | "quick_replies"
  | "upload_photos";

type ToolDef = {
  id: ToolId;
  title: string;
  description: string;
  actionLabel: string;
  keywords: string[];
  section: "quick" | "capture" | "follow_up" | "assets";
  icon: typeof UserRoundPlus;
  iconTint: string;
  featured?: boolean;
};

const TOOLS: ToolDef[] = [
  {
    id: "add_lead",
    title: "Add lead",
    description: "Capture a new customer enquiry and add it to your pipeline.",
    actionLabel: "Add lead",
    keywords: ["lead", "add", "new", "enquiry", "customer"],
    section: "quick",
    icon: UserRoundPlus,
    iconTint: "bg-sales-brand-soft text-sales-brand-fg",
    featured: true,
  },
  {
    id: "log_call",
    title: "Log a call",
    description: "Record a customer call, outcome and next follow-up.",
    actionLabel: "Log call",
    keywords: ["call", "log", "phone", "outcome"],
    section: "quick",
    icon: PhoneCall,
    iconTint: "bg-sales-teal-soft text-sales-teal",
    featured: true,
  },
  {
    id: "create_quote",
    title: "Create quote",
    description: "Prepare a professional quotation and connect it to a customer or deal.",
    actionLabel: "Create quote",
    keywords: ["quote", "quotation", "pricing", "proposal"],
    section: "quick",
    icon: FilePlus2,
    iconTint: "bg-sales-purple-soft text-sales-purple",
    featured: true,
  },
  {
    id: "schedule_follow_up",
    title: "Schedule follow-up",
    description: "Plan your next call, meeting or customer follow-up.",
    actionLabel: "Schedule",
    keywords: ["schedule", "follow-up", "followup", "calendar", "meeting"],
    section: "quick",
    icon: CalendarClock,
    iconTint: "bg-sales-warning-soft text-sales-warning",
    featured: true,
  },
  {
    id: "event_capture",
    title: "Event Capture",
    description: "Capture prospects quickly at exhibitions, trade shows and field events.",
    actionLabel: "Open Event Capture",
    keywords: ["event", "capture", "walk-in", "exhibition", "trade"],
    section: "capture",
    icon: ClipboardList,
    iconTint: "bg-sales-info-soft text-sales-info",
  },
  {
    id: "follow_ups",
    title: "Follow-ups due",
    description: "Review customers you promised to contact again.",
    actionLabel: "View follow-ups",
    keywords: ["follow-up", "due", "overdue", "tasks", "reminders"],
    section: "follow_up",
    icon: ListTodo,
    iconTint: "bg-sales-warning-soft text-sales-warning",
  },
  {
    id: "quick_replies",
    title: "Quick replies",
    description: "Use saved WhatsApp responses for common sales conversations.",
    actionLabel: "Open Sales Hub",
    keywords: ["quick", "replies", "whatsapp", "templates", "messages"],
    section: "follow_up",
    icon: MessageSquareText,
    iconTint: "bg-sales-success-soft text-[#16A34A]",
  },
  {
    id: "upload_photos",
    title: "Upload photos",
    description: "Add project and site photos to SegmiQ for customer presentations and project records.",
    actionLabel: "Upload photos",
    keywords: ["photos", "upload", "images", "media", "project"],
    section: "assets",
    icon: Image,
    iconTint: "bg-sales-success-soft text-sales-success",
  },
];

function toPriorityLead(raw: Record<string, unknown>): PriorityLead {
  return {
    id: String(raw.id),
    name: (raw.name as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    status: (raw.status as string) ?? "NEW",
    score: typeof raw.score === "number" ? raw.score : null,
    is_stale: (raw.is_stale as boolean | null) ?? null,
    budget: (raw.budget as string | null) ?? null,
    project_type: (raw.project_type as string | null) ?? null,
    timeline: (raw.timeline as string | null) ?? null,
    form_data: (raw.form_data as Record<string, unknown> | null) ?? null,
    created_at: (raw.created_at as string) ?? new Date().toISOString(),
    follow_up_date: (raw.follow_up_date as string | null) ?? null,
    followUpDue: false,
    priorityLabel: "",
    priorityColor: "",
    priorityOrder: 0,
    client_id: String(raw.client_id ?? ""),
    source: (raw.source as string | null) ?? null,
  };
}

function readRecent(): ToolId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = new Set(TOOLS.map((t) => t.id));
    return parsed.filter((id): id is ToolId => typeof id === "string" && ids.has(id as ToolId)).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function pushRecent(id: ToolId) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function SalesToolboxClient({
  assignmentMode = "direct",
}: {
  assignmentMode?: "direct" | "pool" | "round_robin";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("tools") ?? "";
  const { toast } = useSalesToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [leads, setLeads] = useState<PriorityLead[]>([]);
  const [dueToday, setDueToday] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [quickReplyCount, setQuickReplyCount] = useState<number | null>(null);
  const [draftQuotes, setDraftQuotes] = useState<number | null>(null);
  const [hasTemplates, setHasTemplates] = useState(false);
  const [quoteCandidates, setQuoteCandidates] = useState<
    Array<{
      id: string;
      name: string | null;
      phone: string | null;
      projectType: string | null;
      clientId: string;
      status: string;
    }>
  >([]);
  const [recent, setRecent] = useState<ToolId[]>([]);

  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<{
    quotation: QuotationWithItems;
    leadPhone: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [leadsRes, tasksRes, repliesRes, quotesRes] = await Promise.all([
        fetch("/api/sales/app/leads"),
        fetch("/api/sales/tasks?view=mine"),
        fetch("/api/inbox/quick-replies"),
        fetch("/api/sales/quotes?status=draft&period=this_year"),
      ]);

      if (leadsRes.ok) {
        const j = (await leadsRes.json()) as { leads?: Record<string, unknown>[] };
        const active = (j.leads ?? []).filter((l) => {
          const s = String(l.status ?? "");
          return ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"].includes(s);
        });
        setLeads(active.map(toPriorityLead));
      }

      if (tasksRes.ok) {
        const j = (await tasksRes.json()) as {
          kpis?: { dueToday?: number; overdue?: number };
        };
        setDueToday(j.kpis?.dueToday ?? 0);
        setOverdue(j.kpis?.overdue ?? 0);
      }

      if (repliesRes.ok) {
        const j = (await repliesRes.json()) as { replies?: unknown[] };
        setQuickReplyCount(Array.isArray(j.replies) ? j.replies.length : 0);
      } else {
        setQuickReplyCount(null);
      }

      if (quotesRes.ok) {
        const j = (await quotesRes.json()) as {
          kpis?: { total?: { value?: number } };
          quotes?: unknown[];
          meta?: { hasTemplates?: boolean };
          createCandidates?: typeof quoteCandidates;
        };
        const drafts =
          typeof j.kpis?.total?.value === "number"
            ? j.kpis.total.value
            : Array.isArray(j.quotes)
              ? j.quotes.length
              : null;
        setDraftQuotes(drafts);
        setHasTemplates(Boolean(j.meta?.hasTemplates));
        if (Array.isArray(j.createCandidates)) {
          setQuoteCandidates(j.createCandidates);
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRecent(readRecent());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const badgeFor = useCallback(
    (id: ToolId): string | null => {
      if (id === "follow_ups") {
        const due = dueToday + overdue;
        if (due <= 0) return null;
        return `${due} due`;
      }
      if (id === "quick_replies" && quickReplyCount != null) {
        return `${quickReplyCount} saved`;
      }
      return null;
    },
    [dueToday, overdue, quickReplyCount]
  );

  function markUsed(id: ToolId) {
    pushRecent(id);
    setRecent(readRecent());
  }

  function runTool(id: ToolId) {
    markUsed(id);
    switch (id) {
      case "add_lead":
        setAddLeadOpen(true);
        break;
      case "log_call":
        setLogCallOpen(true);
        break;
      case "create_quote":
        setCreateQuoteOpen(true);
        break;
      case "schedule_follow_up":
        setScheduleOpen(true);
        break;
      case "event_capture":
        router.push("/sales/event-capture");
        break;
      case "follow_ups":
        router.push(overdue > 0 ? "/sales/tasks?status=overdue" : "/sales/tasks?due=today");
        break;
      case "quick_replies":
        router.push("/sales/inbox");
        break;
      case "upload_photos":
        router.push("/upload");
        break;
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter((t) => {
      const hay = [t.title, t.description, ...t.keywords].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const bySection = useMemo(() => {
    const groups = {
      quick: filtered.filter((t) => t.section === "quick"),
      capture: filtered.filter((t) => t.section === "capture"),
      follow_up: filtered.filter((t) => t.section === "follow_up"),
      assets: filtered.filter((t) => t.section === "assets"),
    };
    return groups;
  }, [filtered]);

  const recentTools = useMemo(
    () => recent.map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean) as ToolDef[],
    [recent]
  );

  const showShortcuts = dueToday > 0 || overdue > 0 || (draftQuotes != null && draftQuotes > 0);

  if (editingQuote) {
    const q = editingQuote.quotation;
    return (
      <QuotationBuilder
        quotation={q}
        clientId={q.client_id}
        leadPhone={editingQuote.leadPhone}
        readOnly={q.status !== "draft"}
        onSaved={(updated) =>
          setEditingQuote({ quotation: updated, leadPhone: editingQuote.leadPhone })
        }
        onSent={() => {
          setEditingQuote(null);
          toast({
            tone: "success",
            title: "Quote sent",
            description: "Quotation was sent.",
          });
          void load();
        }}
        onClose={() => {
          setEditingQuote(null);
          void load();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[190px] rounded-sales-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-sales-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError && leads.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-8">
          <p className="text-[15px] font-semibold text-sales-text-primary">
            Couldn&apos;t load Toolbox information
          </p>
          <p className="text-[13px] text-sales-text-secondary">Check your connection and try again.</p>
          <button
            type="button"
            className="text-[13px] font-semibold text-sales-brand-fg"
            onClick={() => void load()}
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  function Section({
    title,
    description,
    tools,
    featured,
  }: {
    title: string;
    description: string;
    tools: ToolDef[];
    featured?: boolean;
  }) {
    if (!tools.length) return null;
    return (
      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-sales-text-primary">{title}</h2>
          <p className="mt-0.5 text-[13px] text-sales-text-secondary">{description}</p>
        </div>
        <div
          className={cn(
            "grid grid-cols-1 gap-3 sm:grid-cols-2",
            featured ? "xl:grid-cols-4" : "xl:grid-cols-3"
          )}
        >
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              icon={tool.icon}
              iconTint={tool.iconTint}
              title={tool.title}
              description={tool.description}
              actionLabel={tool.actionLabel}
              badge={badgeFor(tool.id)}
              featured={featured}
              onClick={() => runTool(tool.id)}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div
        className={cn(
          "grid grid-cols-1 gap-6",
          showShortcuts ? "min-[1400px]:grid-cols-[minmax(0,1fr)_240px]" : ""
        )}
      >
        <div className="min-w-0 space-y-8">
          {query.trim() ? (
            filtered.length ? (
              <section className="space-y-3">
                <h2 className="text-[15px] font-semibold text-sales-text-primary">
                  Search results
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      icon={tool.icon}
                      iconTint={tool.iconTint}
                      title={tool.title}
                      description={tool.description}
                      actionLabel={tool.actionLabel}
                      badge={badgeFor(tool.id)}
                      onClick={() => runTool(tool.id)}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-[13px] text-sales-text-secondary">
                  No tools match &ldquo;{query.trim()}&rdquo;.
                </CardContent>
              </Card>
            )
          ) : (
            <>
              <Section
                title="Quick actions"
                description="Start the sales actions you use most."
                tools={bySection.quick}
                featured
              />
              <Section
                title="Lead capture"
                description="Capture new opportunities from the field, events and direct enquiries."
                tools={bySection.capture}
              />
              <Section
                title="Sales & follow-up"
                description="Stay on top of conversations and promised callbacks."
                tools={bySection.follow_up}
              />
              <Section
                title="Content & assets"
                description="Keep project media ready for customer conversations."
                tools={bySection.assets}
              />
              {recentTools.length > 0 ? (
                <section className="space-y-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-sales-text-primary">
                      Recently used
                    </h2>
                    <p className="mt-0.5 text-[13px] text-sales-text-secondary">
                      Jump back into tools you opened on this device.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {recentTools.map((tool) => (
                      <ToolCard
                        key={`recent-${tool.id}`}
                        icon={tool.icon}
                        iconTint={tool.iconTint}
                        title={tool.title}
                        description={tool.description}
                        actionLabel={tool.actionLabel}
                        badge={badgeFor(tool.id)}
                        onClick={() => runTool(tool.id)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>

        {showShortcuts ? (
          <aside className="space-y-3 min-[1400px]:sticky min-[1400px]:top-4 min-[1400px]:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s shortcuts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dueToday > 0 || overdue > 0 ? (
                  <ShortcutRow
                    label="Follow-ups due"
                    value={String(dueToday + overdue)}
                    hint={
                      overdue > 0
                        ? `${overdue} overdue · ${dueToday} today`
                        : `${dueToday} due today`
                    }
                    onClick={() => runTool("follow_ups")}
                  />
                ) : null}
                {draftQuotes != null && draftQuotes > 0 ? (
                  <ShortcutRow
                    label="Draft quotes"
                    value={String(draftQuotes)}
                    hint="Finish and send"
                    onClick={() => router.push("/sales/quotes?status=draft")}
                  />
                ) : null}
              </CardContent>
            </Card>
          </aside>
        ) : null}
      </div>

      {addLeadOpen ? (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          mode="salesperson"
          onClose={() => setAddLeadOpen(false)}
          onSuccess={() => {
            setAddLeadOpen(false);
            toast({ tone: "success", title: "Lead added" });
            void load();
            router.refresh();
          }}
        />
      ) : null}

      {logCallOpen ? (
        <QuickLogSheet
          leads={leads}
          preselectedLeadId=""
          onClose={() => setLogCallOpen(false)}
          onSuccess={() => {
            toast({ tone: "success", title: "Call logged" });
            void load();
            router.refresh();
          }}
        />
      ) : null}

      {scheduleOpen ? (
        <AddEventSheet
          leads={leads}
          defaultDateKey={toDateKey(new Date())}
          onClose={() => setScheduleOpen(false)}
          onCreated={() => {
            setScheduleOpen(false);
            toast({
              tone: "success",
              title: "Follow-up scheduled",
              description: "Added to your calendar and tasks.",
            });
            void load();
            router.refresh();
          }}
        />
      ) : null}

      <CreateQuoteDialog
        open={createQuoteOpen}
        candidates={
          quoteCandidates.length
            ? quoteCandidates
            : leads.map((l) => ({
                id: l.id,
                name: l.name,
                phone: l.phone,
                projectType: l.project_type ?? null,
                clientId: l.client_id,
                status: l.status,
              }))
        }
        hasTemplates={hasTemplates}
        onClose={() => setCreateQuoteOpen(false)}
        onCreated={(quotation, leadPhone) => {
          setEditingQuote({ quotation, leadPhone });
          toast({
            tone: "success",
            title: "Quote created",
            description: "Draft saved — add line items and send when ready.",
          });
          void load();
        }}
      />
    </div>
  );
}

function ShortcutRow({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2.5 text-left transition-colors hover:border-sales-border-strong"
    >
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-sales-text-primary">{label}</p>
        <p className="mt-0.5 text-[11px] text-sales-text-muted">{hint}</p>
      </div>
      <span className="text-[18px] font-semibold tabular-nums text-sales-text-primary">{value}</span>
    </button>
  );
}
