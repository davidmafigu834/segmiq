import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CrmButton } from "./crm";
import {
  createManualLead,
  lookupContactByPhone,
  SOURCES,
  type ContactLookupMatch,
} from "../lib/contacts";
import { MANUAL_LEAD_STAGES, type LeadStatus } from "../lib/types";

type Props = {
  open: boolean;
  online: boolean;
  onClose: () => void;
  onCreated: (leadId: string) => void;
};

export function AddLeadSheet({ open, online, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [priority, setPriority] = useState<"hot" | "warm" | "cold" | null>(null);
  const [stage, setStage] = useState<LeadStatus>("NEW");
  const [dealValue, setDealValue] = useState("");
  const [email, setEmail] = useState("");
  const [projectType, setProjectType] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [match, setMatch] = useState<ContactLookupMatch | null>(null);
  const [forceNew, setForceNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setPhone("");
    setSource(SOURCES[0]);
    setPriority(null);
    setStage("NEW");
    setDealValue("");
    setEmail("");
    setProjectType("");
    setBudget("");
    setNotes("");
    setShowMore(false);
    setMatch(null);
    setForceNew(false);
    setError("");
    setSuccess(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setForceNew(false);
    const raw = phone.trim();
    if (raw.replace(/\D/g, "").length < 6) {
      setMatch(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void lookupContactByPhone(raw).then(setMatch);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [phone, open]);

  if (!open) return null;

  const dupeBlocking = !!match && !forceNew;

  async function handleSubmit() {
    if (submitting || dupeBlocking) return;
    if (!online) {
      setError("You need to be online to add a lead.");
      return;
    }
    if (phone.trim().replace(/\D/g, "").length < 6) {
      setError("Enter a valid phone number.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const payload: Parameters<typeof createManualLead>[0] = {
        name,
        phone,
        source,
        initialStatus: stage,
        email,
        projectType,
        budget,
        notes,
        forceNew,
      };
      if (priority) payload.priority = priority;
      if (stage === "WON" && dealValue.trim()) {
        const dv = parseFloat(dealValue.replace(/[^0-9.]/g, ""));
        if (!Number.isNaN(dv)) payload.dealValue = dv;
      }
      const { leadId } = await createManualLead(payload);
      setSuccess(true);
      window.setTimeout(() => {
        onCreated(leadId);
        onClose();
      }, 800);
    } catch (err) {
      if (err instanceof Error && err.message === "duplicate") {
        const existing = (err as Error & { existing?: ContactLookupMatch }).existing;
        if (existing) setMatch(existing);
        setError("This number already exists. Add anyway or update the existing contact on web.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/70">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <div className="safe-bottom max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-border bg-bg-secondary px-5 pb-6 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-ink-primary">Add lead</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-tertiary text-ink-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <p className="py-8 text-center text-[15px] font-medium text-accent">
            {stage === "WON" ? "Won deal logged!" : "Lead added!"}
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-ink-secondary">Phone *</label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none focus:border-border-focus"
                placeholder="077 123 4567"
                autoFocus
              />
            </div>

            {match && !forceNew ? (
              <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4">
                <p className="text-[14px] font-semibold text-ink-primary">
                  {match.name ?? "Existing contact"}
                </p>
                <p className="mt-1 text-[13px] text-ink-tertiary">
                  {match.lifecycle === "customer" ? "Customer" : "Lead"}
                  {match.owner ? ` · ${match.owner}` : ""}
                </p>
                <button
                  type="button"
                  onClick={() => setForceNew(true)}
                  className="mt-3 text-[13px] font-semibold text-accent"
                >
                  Add as new lead anyway
                </button>
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-[13px] font-medium text-ink-secondary">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none focus:border-border-focus"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-ink-secondary">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-ink-secondary">
                Where are you with them?
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as LeadStatus)}
                className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none"
              >
                {MANUAL_LEAD_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                {MANUAL_LEAD_STAGES.find((s) => s.value === stage)?.hint}
              </p>
            </div>

            {stage === "WON" ? (
              <div>
                <label className="mb-1 block text-[13px] font-medium text-ink-secondary">
                  Deal value
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none focus:border-border-focus"
                  placeholder="optional — e.g. 4500"
                />
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-secondary">
                Priority <span className="font-normal text-ink-tertiary">(optional)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["hot", "warm", "cold"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority((current) => (current === p ? null : p))}
                    className={`min-h-[44px] rounded-lg border px-2 text-[14px] font-medium capitalize ${
                      priority === p
                        ? "border-accent bg-accent-muted text-accent"
                        : "border-border bg-bg-primary text-ink-primary"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="text-[13px] font-semibold text-accent"
            >
              {showMore ? "Hide optional fields" : "More fields"}
            </button>

            {showMore ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-ink-secondary">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-ink-secondary">
                    Project type
                  </label>
                  <input
                    type="text"
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-ink-secondary">Budget</label>
                  <input
                    type="text"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-ink-secondary">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none"
                  />
                </div>
              </div>
            ) : null}

            {error ? <p className="text-[13px] text-[var(--error)]">{error}</p> : null}

            <CrmButton
              className="w-full"
              disabled={submitting || dupeBlocking}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Adding…" : stage === "WON" ? "Log won deal" : "Add lead"}
            </CrmButton>
          </div>
        )}
      </div>
    </div>
  );
}
