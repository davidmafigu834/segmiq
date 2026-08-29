"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
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
import { HUB_RE_SOURCES } from "@/lib/real-estate/marketing";
import type { ContactLifecycle, LeadStatus } from "@/types";
import { PremiumSheet } from "./PremiumSheet";

type AssignmentMode = "direct" | "pool" | "round_robin";
type LookupMatch = {
  id: string;
  name: string | null;
  lifecycle: ContactLifecycle | "lead";
  owner: string | null;
  ownerId?: string | null;
  ownedByYou?: boolean;
  leadId?: string | null;
  leadStatus?: string | null;
  lastTouchedAt: string | null;
} | null;

const SOURCES = ["Referral", "Walk-in", "Phone call", "WhatsApp", "Repeat customer", "Other"];

const fieldClass =
  "h-11 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none transition-colors placeholder:text-sales-text-muted focus:border-sales-brand focus:ring-2 focus:ring-[rgba(212,255,79,0.35)]";

const labelClass = "text-[12px] font-medium text-sales-text-secondary";

const chipActive =
  "border-[rgba(160,210,30,0.55)] bg-[rgba(212,255,79,0.16)]";
const chipIdle = "border-sales-border bg-sales-surface hover:bg-sales-surface-hover";

export function AddToHubSheet({
  assignmentMode,
  mode = "salesperson",
  clientId,
  defaultSource,
  defaultType = "lead",
  lockType = false,
  hideSourceField = false,
  variant = "default",
  realEstate = false,
  initialContact,
  defaultForceNew = false,
  onClose,
  onSuccess,
}: {
  assignmentMode: AssignmentMode;
  mode?: "salesperson" | "manager";
  clientId?: string;
  defaultSource?: string;
  defaultType?: "lead" | "customer";
  lockType?: boolean;
  hideSourceField?: boolean;
  variant?: "default" | "walk_in";
  realEstate?: boolean;
  initialContact?: { name?: string | null; phone?: string | null; email?: string | null };
  defaultForceNew?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<"lead" | "customer">(defaultType);
  const [customerType, setCustomerType] = useState<"" | "company" | "individual">("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [name, setName] = useState(initialContact?.name ?? "");
  const [phone, setPhone] = useState(initialContact?.phone ?? "");
  const sourceOptions = realEstate ? [...HUB_RE_SOURCES] : SOURCES;
  const [source, setSource] = useState(defaultSource ?? sourceOptions[0]);
  const [referredBy, setReferredBy] = useState("");
  const [portalName, setPortalName] = useState("");
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
    if (!isLead && !name.trim()) {
      setError("Enter the Customer name.");
      return;
    }
    if (!isLead && !customerType) {
      setError("Select whether this Customer is a company or an individual.");
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
      if (realEstate && source === "Referral" && referredBy.trim()) body.referredBy = referredBy.trim();
      if (realEstate && source === "Property Portal" && portalName.trim()) body.portalName = portalName.trim();
      if (clientId) body.clientId = clientId;
      if (!isLead) {
        body.customerType = customerType;
        body.primaryContactName = primaryContactName.trim() || undefined;
        body.industry = industry.trim() || undefined;
        body.location = location.trim() || undefined;
        body.assigneeId = assigneeId || undefined;
      }
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

  const salespersonNote = "Assigned to you — you added it, so it's yours.";

  return (
    <PremiumSheet
      eyebrow={variant === "walk_in" ? "Front desk" : isLead ? "Customer Hub" : "Company / Customers"}
      title={variant === "walk_in" ? "Log walk-in" : isLead ? "Add lead" : "Add Customer"}
      description={
        variant === "walk_in"
          ? "They came to you — record what happens next."
          : isLead
            ? "Capture someone and start working them."
            : "File someone you've already done business with."
      }
      onClose={onClose}
      labelledBy="add-hub-sheet-title"
      maxWidthClass="max-w-[480px]"
    >
      {success ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[12px] bg-sales-success-soft text-sales-success-fg">
            <CheckCircle2 size={22} strokeWidth={1.8} />
          </div>
          <p className="text-[15px] font-semibold text-sales-text-primary">
            {variant === "walk_in" || isWalkInFlow
              ? "Walk-in logged"
              : isLead
                ? stage === "WON"
                  ? "Won deal logged"
                  : "Lead added"
                : "Customer saved"}
          </p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">Closing…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
              {variant !== "walk_in" && !lockType && (
              <div className="flex gap-2">
                {(["lead", "customer"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-[10px] border px-3 py-2.5 text-left transition ${
                      type === t ? chipActive : chipIdle
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-sales-text-primary">
                      {t === "lead" ? (
                        <Send
                          size={15}
                          className={type === t ? "text-sales-brand-fg" : "text-sales-text-muted"}
                        />
                      ) : (
                        <Users
                          size={15}
                          className={type === t ? "text-sales-brand-fg" : "text-sales-text-muted"}
                        />
                      )}
                      {t === "lead" ? "New lead" : "Existing customer"}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-sales-text-muted">
                      {t === "lead" ? "Enters the pipeline." : "Files to Customers."}
                    </span>
                  </button>
                ))}
              </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>{isLead ? "Name" : "Customer name"}</span>
                <input
                  className={fieldClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isLead ? "e.g. Tendai Moyo" : "e.g. Moyo Residence"}
                />
              </label>

              {!isLead ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Customer type</span>
                    <select
                      className={fieldClass}
                      value={customerType}
                      onChange={(e) => setCustomerType(e.target.value as typeof customerType)}
                    >
                      <option value="">Select…</option>
                      <option value="company">Company</option>
                      <option value="individual">Individual</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Location</span>
                    <input
                      className={fieldClass}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Harare"
                    />
                  </label>
                </div>
              ) : null}

              {!isLead && customerType === "company" ? (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Primary contact</span>
                  <input
                    className={fieldClass}
                    value={primaryContactName}
                    onChange={(e) => setPrimaryContactName(e.target.value)}
                    placeholder="e.g. Tendai Moyo"
                  />
                </label>
              ) : null}

              {!isLead ? (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Industry / category</span>
                  <input
                    className={fieldClass}
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="optional — e.g. Residential Solar"
                  />
                </label>
              ) : null}

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>
                  Phone <span className="text-sales-brand-fg">*</span>
                </span>
                <input
                  className={fieldClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0772 123 456"
                  inputMode="tel"
                />
              </label>

              {dupeBlocking && (
                <div className="flex gap-2.5 rounded-[10px] border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] p-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#F59E0B]" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] leading-snug text-sales-text-primary">
                      Already in your Customer Hub
                      {match?.name ? (
                        <>
                          {" "}
                          as <b>{match.name}</b>
                        </>
                      ) : null}
                      {match?.ownedByYou ? (
                        <span className="text-sales-text-muted"> · owned by you</span>
                      ) : match?.owner ? (
                        <span className="text-sales-text-muted"> · owned by {match.owner}</span>
                      ) : (
                        <span className="text-sales-text-muted"> · unassigned</span>
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setForceNew(true)}
                        className="rounded-[8px] border border-[#F59E0B] px-2.5 py-1 text-[12px] font-medium text-[#B54708]"
                      >
                        Add anyway
                      </button>
                      {mode === "manager" && match?.id ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/client/contacts/${match.id}`)}
                          className="rounded-[8px] border border-sales-border px-2.5 py-1 text-[12px] font-medium text-sales-text-primary"
                        >
                          Open existing
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-[8px] border border-sales-border px-2.5 py-1 text-[12px] font-medium text-sales-text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {match && isLead && forceNew && (
                <p className="text-[11.5px] text-sales-text-muted">
                  Adding as a new job under the existing contact.
                </p>
              )}

              {!hideSourceField ? (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>
                    {realEstate ? "How did this client hear about us?" : "Source"}
                  </span>
                  <select
                    className={fieldClass}
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    {sourceOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" value={source} readOnly />
              )}

              {realEstate && source === "Referral" ? (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Referred by</span>
                  <input
                    className={fieldClass}
                    value={referredBy}
                    onChange={(e) => setReferredBy(e.target.value)}
                    placeholder="Existing client or introducer"
                  />
                </label>
              ) : null}

              {realEstate && source === "Property Portal" ? (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Portal</span>
                  <select
                    className={fieldClass}
                    value={portalName}
                    onChange={(e) => setPortalName(e.target.value)}
                  >
                    <option value="">Select portal</option>
                    <option value="Property24">Property24</option>
                    <option value="Private Property">Private Property</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              ) : null}

              {isWalkInFlow && (
                <div className="flex flex-col gap-2">
                  <span className={labelClass}>
                    What happened? <span className="text-sales-brand-fg">*</span>
                  </span>
                  <div className="flex flex-col gap-2">
                    {WALK_IN_OUTCOMES.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setIntakeOutcome(o.value)}
                        className={`rounded-[10px] border px-3 py-2.5 text-left transition ${
                          intakeOutcome === o.value ? chipActive : chipIdle
                        }`}
                      >
                        <span className="block text-[13px] font-semibold text-sales-text-primary">
                          {o.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-sales-text-muted">
                          {o.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isWalkInFlow && intakeOutcome === "follow_up_later" && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>
                    Follow-up date <span className="text-sales-brand-fg">*</span>
                  </span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </label>
              )}

              {isWalkInFlow && intakeOutcome === "won_on_spot" && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Deal value</span>
                  <input
                    className={fieldClass}
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="optional — e.g. 4500"
                    inputMode="decimal"
                  />
                </label>
              )}

              {isWalkInFlow && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Notes</span>
                  <input
                    className={fieldClass}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What did they ask for?"
                  />
                </label>
              )}

              {isLead && !isWalkInFlow && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Where are you with them?</span>
                  <select
                    className={fieldClass}
                    value={stage}
                    onChange={(e) => setStage(e.target.value as LeadStatus)}
                  >
                    {MANUAL_LEAD_STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-sales-text-muted">
                    {MANUAL_LEAD_STAGES.find((s) => s.value === stage)?.hint}
                  </span>
                </label>
              )}

              {isLead && !isWalkInFlow && stage === "WON" && (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Deal value</span>
                  <input
                    className={fieldClass}
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="optional — e.g. 4500"
                    inputMode="decimal"
                  />
                </label>
              )}

              {isLead && !isWalkInFlow && (
                <div className="flex flex-col gap-1.5">
                  <span className={labelClass}>Priority</span>
                  <div className="flex gap-2">
                    {(["hot", "warm", "cold"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 rounded-[10px] border px-3 py-2 text-[12.5px] font-medium capitalize transition ${
                          priority === p
                            ? `${chipActive} text-sales-text-primary`
                            : `${chipIdle} text-sales-text-secondary`
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
                className="flex items-center gap-1.5 self-start text-[12.5px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
              >
                <ChevronDown size={15} className={`transition ${showMore ? "rotate-180" : ""}`} />{" "}
                More details
              </button>
              {showMore && (
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Email</span>
                    <input
                      className={fieldClass}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="optional"
                      inputMode="email"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className={labelClass}>Project type</span>
                      <input
                        className={fieldClass}
                        value={projectType}
                        onChange={(e) => setProjectType(e.target.value)}
                        placeholder="e.g. Solar install"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className={labelClass}>Budget</span>
                      <input
                        className={fieldClass}
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="e.g. $4,000"
                      />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Notes</span>
                    <input
                      className={fieldClass}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="One line of context"
                    />
                  </label>
                </div>
              )}

              {isLead && mode === "manager" && (
                <div className="flex flex-col gap-2">
                  <span className={labelClass}>Assign to</span>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="assign"
                      checked={assignChoice === "specific"}
                      onChange={() => setAssignChoice("specific")}
                      className="accent-[#D4FF4F]"
                    />
                    <span className="text-[13px] text-sales-text-primary">A salesperson</span>
                    {assignChoice === "specific" && (
                      <select
                        className={`${fieldClass} ml-auto max-w-[160px]`}
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
                      className="accent-[#D4FF4F]"
                    />
                    <span className="text-[13px] text-sales-text-primary">
                      Team pool{" "}
                      <span className="text-[11px] text-sales-text-muted">· anyone can claim</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="assign"
                      checked={assignChoice === "auto"}
                      onChange={() => setAssignChoice("auto")}
                      className="accent-[#D4FF4F]"
                    />
                    <span className="text-[13px] text-sales-text-primary">
                      Auto{" "}
                      <span className="text-[11px] text-sales-text-muted">· round-robin</span>
                    </span>
                  </label>
                </div>
              )}
              {!isLead && mode === "manager" ? (
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Relationship owner</span>
                  <select
                    className={fieldClass}
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {salespeople.map((salesperson) => (
                      <option key={salesperson.id} value={salesperson.id}>
                        {salesperson.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {isLead && mode === "salesperson" && (
                <div className="flex items-center gap-2.5 rounded-[10px] border border-sales-border bg-sales-surface-hover px-3 py-2.5">
                  <Check size={15} className="shrink-0 text-sales-brand-fg" />
                  <span className="text-[12.5px] text-sales-text-secondary">{salespersonNote}</span>
                </div>
              )}

              {error && <p className="text-[12.5px] text-sales-danger">{error}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  dupeBlocking ||
                  (isLead && mode === "manager" && assignChoice === "specific" && !assigneeId)
                }
                className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sales-neutral-900)]/30 disabled:opacity-50"
              >
                <UserPlus size={15} strokeWidth={1.8} />{" "}
                {variant === "walk_in" || isWalkInFlow
                  ? "Save walk-in"
                  : isLead
                    ? stage === "WON"
                      ? "Log won deal"
                      : "Add lead"
                    : "Save customer"}
              </button>
        </div>
      )}
    </PremiumSheet>
  );
}

export function useAddHubSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return {
    openAddHubSheet: () => setOpen(true),
    addHubSheetProps: (
      assignmentMode: AssignmentMode,
      options?: {
        mode?: "salesperson" | "manager";
        clientId?: string;
        defaultType?: "lead" | "customer";
        lockType?: boolean;
        realEstate?: boolean;
      }
    ) => ({
      openAddHubSheet: () => setOpen(true),
      hubSheet: open ? (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          mode={options?.mode ?? "salesperson"}
          clientId={options?.clientId}
          defaultType={options?.defaultType}
          lockType={options?.lockType}
          realEstate={options?.realEstate}
          onClose={() => setOpen(false)}
          onSuccess={() => router.refresh()}
        />
      ) : null,
    }),
  };
}
