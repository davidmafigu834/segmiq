"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  UserPlus,
  Users,
  Send,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Check,
} from "lucide-react";

import {
  WALK_IN_OUTCOMES,
  isWalkInSource,
  type WalkInIntakeOutcome,
} from "@/lib/walk-in-intake";
import { MANUAL_LEAD_STAGES } from "@/lib/customer-hub/manual-lead-stages";
import { IN_PERSON_HUB_SOURCES } from "@/lib/customer-hub/recent-status";
import type { ContactLifecycle, LeadStatus } from "@/types";
import {
  CONTACT_LIFECYCLE_LABELS,
  lifecycleBadgeClass,
  normalizeLegacyLifecycle,
} from "@/lib/customer-hub/lifecycle";

type AssignmentMode = "direct" | "pool" | "round_robin";
type LookupMatch = {
  id: string;
  name: string | null;
  lifecycle: ContactLifecycle | "lead";
  owner: string | null;
  lastTouchedAt: string | null;
} | null;

const SOURCES = ["Referral", "Walk-in", "Phone call", "WhatsApp", "Repeat customer", "Other"];

export function AddToHubSheet({
  assignmentMode,
  mode = "salesperson",
  clientId,
  defaultSource,
  hideSourceField = false,
  variant = "default",
  initialContact,
  defaultForceNew = false,
  onClose,
  onSuccess,
}: {
  assignmentMode: AssignmentMode;
  mode?: "salesperson" | "manager";
  clientId?: string;
  defaultSource?: string;
  hideSourceField?: boolean;
  variant?: "default" | "walk_in";
  initialContact?: { name?: string | null; phone?: string | null; email?: string | null };
  defaultForceNew?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<"lead" | "customer">("lead");
  const [name, setName] = useState(initialContact?.name ?? "");
  const [phone, setPhone] = useState(initialContact?.phone ?? "");
  const [source, setSource] = useState(defaultSource ?? SOURCES[0]);
  const [priority, setPriority] = useState<"hot" | "warm" | "cold">("warm");
  const [stage, setStage] = useState<LeadStatus>("NEW");
  const [email, setEmail] = useState(initialContact?.email ?? "");
  const [projectType, setProjectType] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [match, setMatch] = useState<LookupMatch>(null);
  const [forceNew, setForceNew] = useState(defaultForceNew);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const initialChoice =
    assignmentMode === "pool" ? "pool" : assignmentMode === "round_robin" ? "auto" : "specific";
  const [assignChoice, setAssignChoice] = useState<"specific" | "pool" | "auto">(initialChoice);
  const [assigneeId, setAssigneeId] = useState("");
  const [salespeople, setSalespeople] = useState<{ id: string; name: string }[]>([]);
  const [loadingReps, setLoadingReps] = useState(false);
  const [intakeOutcome, setIntakeOutcome] = useState<WalkInIntakeOutcome | "">("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [dealValue, setDealValue] = useState("");
  const router = useRouter();

  const isWalkInFlow = variant === "walk_in" || (type === "lead" && isWalkInSource(source));
  const isLead = variant === "walk_in" ? true : type === "lead";
  const dupeBlocking = !!match && isLead && !forceNew;

  useEffect(() => {
    setForceNew(false);
    const raw = phone.trim();
    if (raw.replace(/\D/g, "").length < 6) {
      setMatch(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts/lookup?${new URLSearchParams({ phone: raw })}`);
        const data = (await res.json().catch(() => ({}))) as { match?: LookupMatch };
        setMatch(data.match ?? null);
      } catch {
        setMatch(null);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [phone]);

  useEffect(() => {
    if (isWalkInFlow) return;
    if (IN_PERSON_HUB_SOURCES.has(source) && stage === "NEW") {
      setStage("CONTACTED");
    }
  }, [source, isWalkInFlow, stage]);

  useEffect(() => {
    if (mode !== "manager" || !clientId) return;
    setLoadingReps(true);
    fetch(`/api/clients/${clientId}/users`)
      .then((r) => r.json())
      .then((d: { users?: { id: string; name: string }[] }) => setSalespeople(d.users ?? []))
      .catch(() => setSalespeople([]))
      .finally(() => setLoadingReps(false));
  }, [mode, clientId]);

  async function handleSubmit() {
    if (submitting) return;
    setError("");
    if (phone.trim().replace(/\D/g, "").length < 6) {
      setError("Enter a valid phone number.");
      return;
    }
    if (isWalkInFlow && !intakeOutcome) {
      setError("Select what happened at the desk.");
      return;
    }
    if (isWalkInFlow && intakeOutcome === "follow_up_later" && !followUpDate) {
      setError("Pick a follow-up date.");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        type,
        phone: phone.trim(),
        source,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        projectType: projectType.trim() || undefined,
        budget: budget.trim() || undefined,
        forceNew: forceNew || undefined,
      };
      if (isLead) body.priority = priority;
      if (isLead && !isWalkInFlow) {
        body.initialStatus = stage;
        if (stage === "WON" && dealValue.trim()) {
          const dv = parseFloat(dealValue.replace(/[^0-9.]/g, ""));
          if (!Number.isNaN(dv)) body.dealValue = dv;
        }
      }
      if (isWalkInFlow && intakeOutcome) {
        body.intakeOutcome = intakeOutcome;
        if (followUpDate) body.followUpDate = followUpDate;
        if (dealValue.trim()) {
          const dv = parseFloat(dealValue.replace(/[^0-9.]/g, ""));
          if (!Number.isNaN(dv)) body.dealValue = dv;
        }
      }
      if (isLead && mode === "manager") {
        body.assignMode = assignChoice === "auto" ? "round_robin" : assignChoice;
        if (assignChoice === "specific") body.assigneeId = assigneeId;
      }
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        existing?: LookupMatch;
      };
      if (res.status === 409 && j.error === "duplicate") {
        setMatch(j.existing ?? match);
        setForceNew(false);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError(j.error || "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  const noteByMode: Record<AssignmentMode, string> = {
    direct: "Assigned to you — you added it, so it's yours.",
    pool: "Goes to the team pool — anyone can claim it.",
    round_robin: "Auto-assigned by round-robin to whoever's next.",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/75"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(92dvh,100dvh)] w-full flex-col rounded-t-2xl border-x border-t border-[var(--border)] bg-[var(--surface-card)] sm:max-w-md sm:mx-auto">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-[var(--bg-quaternary)]" />

        <div className="flex shrink-0 items-start justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[18px] font-semibold text-[var(--text-primary)]">
              {variant === "walk_in" ? "Log walk-in" : "Add to Customer Hub"}
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              {variant === "walk_in"
                ? "They came to you — record what happens next."
                : isLead
                  ? "Capture someone and start working them."
                  : "File someone you've already done business with."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <X size={14} />
          </button>
        </div>

        {success ? (
          <div
            className="ag-fade-in flex flex-col items-center justify-center py-6 text-center"
            style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)]">
              <CheckCircle2 size={22} className="text-[var(--success)]" />
            </div>
            <p className="text-[15px] font-semibold text-[var(--success)]">
              {variant === "walk_in" || isWalkInFlow
                ? "Walk-in logged"
                : isLead
                  ? stage === "WON"
                    ? "Won deal logged"
                    : "Lead added"
                  : "Customer saved"}
            </p>
          </div>
        ) : (
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-5"
            style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
          >
            <div className="ag-fade-in flex flex-col gap-4">
              {variant !== "walk_in" && (
              <div className="flex gap-2">
                {(["lead", "customer"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition ${
                      type === t
                        ? "border-[var(--accent-border)] bg-[var(--accent-muted)]"
                        : "border-[var(--border)] bg-[var(--bg-quaternary)]"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                      {t === "lead" ? (
                        <Send
                          size={15}
                          className={
                            type === t ? "text-[var(--accent-fg)]" : "text-[var(--text-tertiary)]"
                          }
                        />
                      ) : (
                        <Users
                          size={15}
                          className={
                            type === t ? "text-[var(--accent-fg)]" : "text-[var(--text-tertiary)]"
                          }
                        />
                      )}
                      {t === "lead" ? "New lead" : "Existing customer"}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[var(--text-tertiary)]">
                      {t === "lead" ? "Enters the pipeline." : "Files to Customers."}
                    </span>
                  </button>
                ))}
              </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Name</span>
                <input
                  className="input-base"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tendai Moyo"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Phone <span className="text-[var(--accent-fg)]">*</span>
                </span>
                <input
                  className="input-base"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0772 123 456"
                  inputMode="tel"
                />
              </label>

              {dupeBlocking && (
                <div className="flex gap-2.5 rounded-xl border border-[rgba(245,166,35,0.4)] bg-[rgba(245,166,35,0.08)] p-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] leading-snug text-[var(--text-primary)]">
                      Already in your Customer Hub
                      {match?.name ? (
                        <>
                          {" "}
                          as <b>{match.name}</b>
                        </>
                      ) : null}
                      {match?.owner ? (
                        <span className="text-[var(--text-tertiary)]"> · owned by {match.owner}</span>
                      ) : (
                        <span className="text-[var(--text-tertiary)]"> · unassigned</span>
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setForceNew(true)}
                        className="rounded-lg border border-[var(--warning)] px-2.5 py-1 text-[12px] font-medium text-[var(--warning)]"
                      >
                        Add anyway
                      </button>
                      {mode === "manager" && match?.id ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/client/contacts/${match.id}`)}
                          className="rounded-lg border border-[var(--border-hover)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-primary)]"
                        >
                          Open existing
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-[var(--border-hover)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-primary)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {match && isLead && forceNew && (
                <p className="text-[11.5px] text-[var(--text-tertiary)]">
                  Adding as a new job under the existing contact.
                </p>
              )}

              {!hideSourceField ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Source</span>
                  <select
                    className="input-base"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" value={source} readOnly />
              )}

              {isWalkInFlow && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    What happened? <span className="text-[var(--accent-fg)]">*</span>
                  </span>
                  <div className="flex flex-col gap-2">
                    {WALK_IN_OUTCOMES.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setIntakeOutcome(o.value)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          intakeOutcome === o.value
                            ? "border-[var(--accent-border)] bg-[var(--accent-muted)]"
                            : "border-[var(--border)] bg-[var(--bg-quaternary)]"
                        }`}
                      >
                        <span className="block text-[13px] font-semibold text-[var(--text-primary)]">
                          {o.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[var(--text-tertiary)]">
                          {o.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isWalkInFlow && intakeOutcome === "follow_up_later" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Follow-up date <span className="text-[var(--accent-fg)]">*</span>
                  </span>
                  <input
                    type="date"
                    className="input-base"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </label>
              )}

              {isWalkInFlow && intakeOutcome === "won_on_spot" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Deal value</span>
                  <input
                    className="input-base"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="optional — e.g. 4500"
                    inputMode="decimal"
                  />
                </label>
              )}

              {isWalkInFlow && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Notes</span>
                  <input
                    className="input-base"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What did they ask for?"
                  />
                </label>
              )}

              {isLead && !isWalkInFlow && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Where are you with them?
                  </span>
                  <select
                    className="input-base"
                    value={stage}
                    onChange={(e) => setStage(e.target.value as LeadStatus)}
                  >
                    {MANUAL_LEAD_STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-[var(--text-tertiary)]">
                    {MANUAL_LEAD_STAGES.find((s) => s.value === stage)?.hint}
                  </span>
                </label>
              )}

              {isLead && !isWalkInFlow && stage === "WON" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Deal value</span>
                  <input
                    className="input-base"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="optional — e.g. 4500"
                    inputMode="decimal"
                  />
                </label>
              )}

              {isLead && !isWalkInFlow && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Priority</span>
                  <div className="flex gap-2">
                    {(["hot", "warm", "cold"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-medium capitalize transition ${
                          priority === p
                            ? "border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                            : "border-[var(--border)] bg-[var(--bg-quaternary)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="flex items-center gap-1.5 self-start text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <ChevronDown size={15} className={`transition ${showMore ? "rotate-180" : ""}`} />{" "}
                More details
              </button>
              {showMore && (
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Email</span>
                    <input
                      className="input-base"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="optional"
                      inputMode="email"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        Project type
                      </span>
                      <input
                        className="input-base"
                        value={projectType}
                        onChange={(e) => setProjectType(e.target.value)}
                        placeholder="e.g. Solar install"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        Budget
                      </span>
                      <input
                        className="input-base"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="e.g. $4,000"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Notes</span>
                    <input
                      className="input-base"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="One line of context"
                    />
                  </label>
                </div>
              )}

              {isLead && mode === "manager" && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Assign to</span>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="assign"
                      checked={assignChoice === "specific"}
                      onChange={() => setAssignChoice("specific")}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-[13px] text-[var(--text-primary)]">A salesperson</span>
                    {assignChoice === "specific" && (
                      <select
                        className="input-base ml-auto max-w-[160px]"
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                      >
                        <option value="">
                          {loadingReps ? "Loading…" : salespeople.length ? "Select…" : "No salespeople"}
                        </option>
                        {salespeople.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="assign"
                      checked={assignChoice === "pool"}
                      onChange={() => setAssignChoice("pool")}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-[13px] text-[var(--text-primary)]">
                      Team pool{" "}
                      <span className="text-[11px] text-[var(--text-tertiary)]">· anyone can claim</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="assign"
                      checked={assignChoice === "auto"}
                      onChange={() => setAssignChoice("auto")}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-[13px] text-[var(--text-primary)]">
                      Auto{" "}
                      <span className="text-[11px] text-[var(--text-tertiary)]">· round-robin</span>
                    </span>
                  </label>
                </div>
              )}
              {isLead && mode === "salesperson" && (
                <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-quaternary)] px-3 py-2.5">
                  <Check size={15} className="shrink-0 text-[var(--accent-fg)]" />
                  <span className="text-[12.5px] text-[var(--text-secondary)]">
                    {noteByMode[assignmentMode]}
                  </span>
                </div>
              )}

              {error && <p className="text-[12.5px] text-[var(--error)]">{error}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  dupeBlocking ||
                  (isLead && mode === "manager" && assignChoice === "specific" && !assigneeId)
                }
                className="btn-primary mt-1 flex w-full items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserPlus size={15} />{" "}
                {variant === "walk_in" || isWalkInFlow
                  ? "Save walk-in"
                  : isLead
                    ? stage === "WON"
                      ? "Log won deal"
                      : "Add lead"
                    : "Save customer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function useAddHubSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return {
    openAddHubSheet: () => setOpen(true),
    addHubSheetProps: (
      assignmentMode: AssignmentMode,
      options?: { mode?: "salesperson" | "manager"; clientId?: string }
    ) => ({
      openAddHubSheet: () => setOpen(true),
      hubSheet: open ? (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          mode={options?.mode ?? "salesperson"}
          clientId={options?.clientId}
          onClose={() => setOpen(false)}
          onSuccess={() => router.refresh()}
        />
      ) : null,
    }),
  };
}
