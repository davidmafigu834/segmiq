"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { AgentSectionNav } from "@/components/dashboard/company/agent/AgentSectionNav";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button, Tabs, ToastProvider, useSalesToast } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { CATEGORY_LABELS, type LearningCandidate, type LearnedKnowledge } from "@/lib/agent/learning/types";
import type { UserRole } from "@/types";

type Tab = "discoveries" | "approved" | "conflicts" | "sources" | "rejected";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LearningCenterPage(props: {
  clientId: string;
  initialCandidateId: string | null;
  initialKnowledgeId?: string | null;
  companyName: string;
  companyLogoUrl: string | null;
  userName: string;
  avatarUrl: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge: number;
}) {
  return (
    <ToastProvider>
      <LearningCenterInner {...props} />
    </ToastProvider>
  );
}

function LearningCenterInner({
  clientId,
  initialCandidateId,
  initialKnowledgeId,
  companyName,
  companyLogoUrl,
  userName,
  avatarUrl,
  unreadNotifications,
  notificationRole,
  whatsappBadge,
}: {
  clientId: string;
  initialCandidateId: string | null;
  initialKnowledgeId?: string | null;
  companyName: string;
  companyLogoUrl: string | null;
  userName: string;
  avatarUrl: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge: number;
}) {
  const { toast } = useSalesToast();
  const [tab, setTab] = useState<Tab>(initialCandidateId ? "discoveries" : "discoveries");
  const [loading, setLoading] = useState(true);
  const [learningOn, setLearningOn] = useState(false);
  const [counts, setCounts] = useState({ discoveries: 0, conflicts: 0, approved: 0, rejected: 0 });
  const [sources, setSources] = useState({ sales: 0, support: 0, corrections: 0, teach: 0, managerFeedback: 0 });
  const [candidates, setCandidates] = useState<LearningCandidate[]>([]);
  const [knowledge, setKnowledge] = useState<LearnedKnowledge[]>([]);
  const [selected, setSelected] = useState<LearningCandidate | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<LearnedKnowledge | null>(null);
  const [knowledgeVersions, setKnowledgeVersions] = useState<Array<Record<string, unknown>>>([]);
  const [evidence, setEvidence] = useState<Array<Record<string, unknown>>>([]);
  const [editContent, setEditContent] = useState("");
  const [destination, setDestination] = useState("LEARNED_KNOWLEDGE");
  const [mergeIntoId, setMergeIntoId] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzed, setAnalyzed] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/learning?tab=${tab}&clientId=${encodeURIComponent(clientId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setLearningOn(Boolean(data.settings?.enabled));
        setCounts(
          data.counts ?? { discoveries: 0, conflicts: 0, approved: 0, rejected: 0 }
        );
        setSources(
          data.sources ?? { sales: 0, support: 0, corrections: 0, teach: 0, managerFeedback: 0 }
        );
        setCandidates(data.candidates ?? []);
        setKnowledge(data.knowledge ?? []);
        setAnalyzed(
          Number(data.sources?.sales ?? 0) +
            Number(data.sources?.support ?? 0) +
            Number(data.sources?.corrections ?? 0) +
            Number(data.sources?.teach ?? 0)
        );
      }
    } finally {
      setLoading(false);
    }
  }, [tab, clientId]);

  const openCandidate = useCallback(async (id: string) => {
    const res = await fetch(`/api/agent/learning/candidates/${id}?clientId=${encodeURIComponent(clientId)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok && data.candidate) {
      setSelected(data.candidate);
      setEvidence(data.evidence ?? []);
      setEditContent(data.candidate.proposedLearning);
    }
  }, [clientId]);

  const openKnowledge = useCallback(async (id: string) => {
    const res = await fetch(`/api/agent/learning/knowledge/${id}?clientId=${encodeURIComponent(clientId)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok && data.knowledge) {
      setSelectedKnowledge(data.knowledge);
      setKnowledgeVersions(data.versions ?? []);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!initialCandidateId) return;
    void openCandidate(initialCandidateId);
  }, [initialCandidateId, openCandidate]);

  useEffect(() => {
    if (!initialKnowledgeId) return;
    void openKnowledge(initialKnowledgeId);
  }, [initialKnowledgeId, openKnowledge]);

  const review = async (action: "approve" | "reject" | "merge") => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/agent/learning/candidates/${selected.id}?clientId=${encodeURIComponent(clientId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          content: editContent,
          destination,
          mergeIntoKnowledgeId: action === "merge" ? mergeIntoId || undefined : undefined,
          reason: action === "reject" ? "Rejected from Learning Center" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      toast({
        title: action === "reject" ? "Candidate rejected" : "Learning approved",
        tone: "success",
      });
      setSelected(null);
      void load();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not save review", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const tabOptions = useMemo(
    () => [
      { value: "discoveries" as const, label: "Discoveries", badge: counts.discoveries || undefined },
      { value: "approved" as const, label: "Approved", badge: counts.approved || undefined },
      { value: "conflicts" as const, label: "Conflicts", badge: counts.conflicts || undefined },
      { value: "sources" as const, label: "Sources" },
      { value: "rejected" as const, label: "Rejected", badge: counts.rejected || undefined },
    ],
    [counts]
  );

  return (
    <CompanyWorkspaceShell
      companyName={companyName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
    >
      <div className="flex min-w-0 flex-col gap-4 pb-8">
        <CompanyDashboardHeader
          unreadNotifications={unreadNotifications}
          notificationRole={notificationRole}
          userName={userName}
          avatarUrl={avatarUrl}
          canAddLead={false}
          breadcrumb="Company / Agent / Learning"
          title="Agent Learning"
          description="See what SegmiQ is learning from your team's real customer conversations."
          primaryAction={
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  learningOn
                    ? "border-sales-brand-border bg-sales-brand-soft text-sales-brand"
                    : "border-sales-border text-sales-text-muted"
                )}
              >
                {learningOn ? "Learning Active" : "Learning Off"}
              </span>
              {!learningOn ? (
                <Link
                  href="/client/settings/automation/agent"
                  className="text-[11px] font-medium text-sales-text-muted underline-offset-2 hover:underline"
                >
                  Settings
                </Link>
              ) : null}
            </div>
          }
          titleActions={
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={13} />} onClick={() => void load()}>
              Refresh
            </Button>
          }
        />

        <AgentSectionNav />

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-sales-text-secondary">
          <span>
            New discoveries <strong className="font-semibold text-sales-text-primary">{counts.discoveries}</strong>
          </span>
          <span>
            Needs review{" "}
            <strong className="font-semibold text-sales-text-primary">{counts.discoveries + counts.conflicts}</strong>
          </span>
          <span>
            Approved <strong className="font-semibold text-sales-text-primary">{counts.approved}</strong>
          </span>
          <span>
            Conflicts <strong className="font-semibold text-sales-text-primary">{counts.conflicts}</strong>
          </span>
        </div>

        {learningOn && analyzed > 0 ? (
          <p className="text-[13px] text-sales-text-secondary">
            SegmiQ has analyzed {analyzed} eligible conversation segments and identified {counts.discoveries} patterns
            that need review.
          </p>
        ) : null}

        <Tabs
          items={tabOptions.map((o) => ({ id: o.value, label: o.label }))}
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
          className="w-full"
        />

        {loading ? (
          <div className="flex h-40 items-center justify-center rounded-[12px] border border-sales-border bg-sales-surface">
            <Loader2 size={18} className="animate-spin text-sales-text-muted" />
          </div>
        ) : !learningOn && tab !== "approved" ? (
          <div className="rounded-[12px] border border-sales-border bg-sales-surface px-5 py-8 text-center">
            <p className="text-[14px] font-semibold text-sales-text-primary">Agent Learning is off.</p>
            <p className="mt-1 text-[13px] text-sales-text-secondary">
              Turn on Learning to let SegmiQ identify useful patterns from your team conversations.
            </p>
            <Link href="/client/settings/automation/agent" className="mt-4 inline-block">
              <Button size="sm">Open Learning Settings</Button>
            </Link>
          </div>
        ) : tab === "sources" ? (
          <section className="rounded-[12px] border border-sales-border bg-sales-surface">
            <ul className="divide-y divide-sales-border-subtle text-[13px]">
              <SourceRow label="Sales conversations" value={sources.sales} />
              <SourceRow label="Support" value={sources.support} />
              <SourceRow label="Human corrections" value={sources.corrections} />
              <SourceRow label="Teach SegmiQ" value={sources.teach} />
            </ul>
          </section>
        ) : tab === "approved" ? (
          knowledge.length === 0 ? (
            <EmptyLearning learningOn={learningOn} />
          ) : (
            <ul className="divide-y divide-sales-border-subtle rounded-[12px] border border-sales-border bg-sales-surface">
              {knowledge.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left"
                    onClick={() => void openKnowledge(item.id)}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                      {CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ?? item.category}
                    </p>
                    <p className="mt-0.5 text-[14px] font-semibold text-sales-text-primary">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] text-sales-text-secondary">{item.content}</p>
                    <p className="mt-2 text-[11px] text-sales-text-muted">
                      {item.source === "SALES_TEAM_LEARNING" ? "Learned from sales team" : item.source.replace(/_/g, " ").toLowerCase()}{" "}
                      · {item.conversationCount} conversations · {item.confidenceLevel.toLowerCase()} · Used {item.usageCount}{" "}
                      times
                      {item.lastReinforcedAt ? ` · last reinforced ${timeAgo(item.lastReinforcedAt)}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : candidates.length === 0 ? (
          <EmptyLearning learningOn={learningOn} />
        ) : (
          <ul className="divide-y divide-sales-border-subtle rounded-[12px] border border-sales-border bg-sales-surface">
            {candidates.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                    {CATEGORY_LABELS[item.category]}
                    {item.comparisonState === "CONFLICTS" ? " · Conflict detected" : ""}
                    {item.previouslyRejected ? " · Previously rejected · new evidence available" : ""}
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-sales-text-primary">{item.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-sales-text-secondary">{item.summary}</p>
                  <p className="mt-2 text-[11px] text-sales-text-muted">
                    {item.conversationCount} conversations · {item.salespersonCount} salespeople ·{" "}
                    {item.confidenceLevel.toLowerCase()} confidence · last observed {timeAgo(item.lastObservedAt)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void openCandidate(item.id)}>
                  Review
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? (
        <PremiumSheet
          title={selected.title}
          eyebrow={CATEGORY_LABELS[selected.category]}
          description={selected.summary}
          onClose={() => setSelected(null)}
          size="lg"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => void review("reject")}>
                Reject
              </Button>
              {selected.comparisonState === "CONFLICTS" ? (
                <Button variant="secondary" disabled={busy} onClick={() => void review("reject")}>
                  Keep company rule
                </Button>
              ) : null}
              <Button disabled={busy} loading={busy} onClick={() => void review("approve")}>
                {editContent !== selected.proposedLearning ? "Edit & approve" : "Approve"}
              </Button>
              {mergeIntoId ? (
                <Button variant="secondary" disabled={busy} onClick={() => void review("merge")}>
                  Merge with existing
                </Button>
              ) : null}
            </div>
          }
        >
          <div className="space-y-4 text-[13px]">
            {selected.riskLevel === "VERY_HIGH" || selected.riskLevel === "HIGH" ? (
              <div className="rounded-[10px] border border-amber-300/50 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Commercial learning. This could affect how SegmiQ handles pricing or payment conversations. Manager
                approval required.
              </div>
            ) : null}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                Proposed learning
              </p>
              <textarea
                className="mt-1 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2 text-[13px] text-sales-text-primary"
                rows={4}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
            <p className="text-[12px] text-sales-text-secondary">
              Observed in {selected.conversationCount} conversations across {selected.salespersonCount} salespeople.
              First observed {timeAgo(selected.firstObservedAt)}. Last observed {timeAgo(selected.lastObservedAt)}.
            </p>
            {selected.existingKnowledgeSummary ? (
              <p className="text-[12px] text-sales-text-secondary">
                Related Company Brain: {selected.existingKnowledgeSummary}
              </p>
            ) : (
              <p className="text-[12px] text-sales-text-secondary">Related Company Brain: no equivalent rule found.</p>
            )}
            <label className="flex flex-col gap-1 text-[12px] text-sales-text-secondary">
              Destination
              <select
                className="rounded-[8px] border border-sales-border bg-sales-surface px-2 py-1.5 text-[13px] text-sales-text-primary"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="LEARNED_KNOWLEDGE">Learned Knowledge only</option>
                <option value="FAQ">Add to FAQs</option>
                <option value="QUALIFICATION_PLAYBOOK">Qualification playbook</option>
                <option value="RESPONSE_EXAMPLE">Response example</option>
                <option value="TERMINOLOGY">Terminology</option>
                <option value="ESCALATION">Escalation</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-sales-text-secondary">
              Merge with existing
              <select
                className="rounded-[8px] border border-sales-border bg-sales-surface px-2 py-1.5 text-[13px] text-sales-text-primary"
                value={mergeIntoId}
                onChange={(e) => setMergeIntoId(e.target.value)}
              >
                <option value="">Do not merge</option>
                {knowledge.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            {selected.comparisonState === "CONFLICTS" ? (
              <Link
                href="/client/settings/automation/company-brain"
                className="inline-block text-[12px] text-sales-text-muted underline-offset-2 hover:underline"
              >
                Update company rule in Company Brain
              </Link>
            ) : null}
            {evidence.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                  Example evidence
                </p>
                <ul className="mt-1 space-y-2">
                  {evidence.map((row) => (
                    <li key={String(row.id)} className="rounded-[8px] border border-sales-border-subtle px-3 py-2">
                      <p className="text-[12px] text-sales-text-secondary">{String(row.excerpt ?? "")}</p>
                      {row.conversation_id ? (
                        <Link
                          href={`/client/inbox?lead=${row.conversation_id}`}
                          className="mt-1 inline-block text-[11px] text-sales-text-muted underline-offset-2 hover:underline"
                        >
                          Open conversation
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </PremiumSheet>
      ) : null}

      {selectedKnowledge ? (
        <PremiumSheet
          title={selectedKnowledge.title}
          eyebrow={CATEGORY_LABELS[selectedKnowledge.category as keyof typeof CATEGORY_LABELS] ?? selectedKnowledge.category}
          description={
            selectedKnowledge.source === "SALES_TEAM_LEARNING"
              ? "Learned from sales team"
              : selectedKnowledge.source === "MANAGER_TAUGHT"
                ? "Manager defined"
                : "Human correction"
          }
          onClose={() => setSelectedKnowledge(null)}
          size="lg"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await fetch(
                      `/api/agent/learning/knowledge/${selectedKnowledge.id}?clientId=${encodeURIComponent(clientId)}`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "deactivate" }),
                      }
                    );
                    if (!res.ok) throw new Error("Could not deactivate");
                    setSelectedKnowledge(null);
                    void load();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Deactivate
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-[13px]">
            <p className="whitespace-pre-wrap text-sales-text-primary">{selectedKnowledge.content}</p>
            <p className="text-[12px] text-sales-text-secondary">
              Evidence {selectedKnowledge.conversationCount} conversations · {selectedKnowledge.salespersonCount}{" "}
              salespeople · Used by Agent {selectedKnowledge.usageCount} times
            </p>
            {selectedKnowledge.approvedBy ? (
              <p className="text-[12px] text-sales-text-muted">
                Approved {selectedKnowledge.approvedAt ? timeAgo(selectedKnowledge.approvedAt) : ""}
              </p>
            ) : null}
            {knowledgeVersions.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-muted">
                  Version history
                </p>
                <ul className="mt-1 space-y-2">
                  {knowledgeVersions.map((row) => (
                    <li key={String(row.id)} className="rounded-[8px] border border-sales-border-subtle px-3 py-2">
                      <p className="text-[12px] text-sales-text-secondary">{String(row.content ?? "")}</p>
                      <p className="mt-1 text-[11px] text-sales-text-muted">
                        {String(row.change_summary ?? "Updated")} · {row.created_at ? timeAgo(String(row.created_at)) : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </PremiumSheet>
      ) : null}
    </CompanyWorkspaceShell>
  );
}

function SourceRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <span className="text-sales-text-primary">{label}</span>
      <span className="tabular-nums text-sales-text-secondary">{value} analyzed</span>
    </li>
  );
}

function EmptyLearning({ learningOn }: { learningOn: boolean }) {
  if (!learningOn) return null;
  return (
    <div className="rounded-[12px] border border-sales-border bg-sales-surface px-5 py-8 text-center">
      <p className="text-[14px] font-semibold text-sales-text-primary">
        SegmiQ is learning from eligible team conversations.
      </p>
      <p className="mt-1 text-[13px] text-sales-text-secondary">
        Useful patterns will appear here when enough evidence is available.
      </p>
    </div>
  );
}
