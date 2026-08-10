"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle } from "lucide-react";
import { LogCallForm } from "@/components/leads/LogCallForm";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { leadCardDisplayName } from "@/lib/leads/whatsapp-lead-display";
import { PremiumSheet } from "./PremiumSheet";

const fieldClass =
  "h-11 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px] text-sales-text-primary outline-none transition-colors placeholder:text-sales-text-muted focus:border-sales-brand focus:ring-2 focus:ring-[rgba(212,255,79,0.35)]";

export function QuickLogSheet({
  leads,
  preselectedLeadId,
  onClose,
  onSuccess,
  defaultChannel = "call",
}: {
  leads: PriorityLead[];
  preselectedLeadId: string;
  onClose: () => void;
  onSuccess: () => void;
  defaultChannel?: "call" | "whatsapp";
}) {
  const [selectedLeadId, setSelectedLeadId] = useState(preselectedLeadId);
  const [success, setSuccess] = useState(false);
  const [businessType, setBusinessType] = useState<"trades" | "real_estate">("trades");

  useEffect(() => {
    setSelectedLeadId(preselectedLeadId);
    setSuccess(false);
  }, [preselectedLeadId]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  useEffect(() => {
    if (!selectedLead?.client_id) {
      setBusinessType("trades");
      return;
    }
    let cancelled = false;
    fetch(`/api/clients/${selectedLead.client_id}/website-integration`)
      .then((r) => r.json())
      .then((j: { business_type?: string }) => {
        if (!cancelled) {
          setBusinessType(j.business_type === "real_estate" ? "real_estate" : "trades");
        }
      })
      .catch(() => {
        if (!cancelled) setBusinessType("trades");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLead?.client_id]);

  const needsLeadPicker = !preselectedLeadId;
  const isWhatsApp = defaultChannel === "whatsapp";

  function handleSubmitSuccess() {
    setSuccess(true);
    window.setTimeout(() => {
      onSuccess();
      onClose();
    }, 1200);
  }

  return (
    <PremiumSheet
      eyebrow={isWhatsApp ? "WhatsApp" : "Call log"}
      title={isWhatsApp ? "Log WhatsApp contact" : "Log a call"}
      description={
        selectedLead && !needsLeadPicker
          ? leadCardDisplayName(selectedLead)
          : "Record the outcome and next step."
      }
      onClose={onClose}
      labelledBy="quick-log-sheet-title"
    >
      {success ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[12px] bg-sales-success-soft text-sales-success-fg">
            <CheckCircle size={22} strokeWidth={1.8} />
          </div>
          <p className="text-[15px] font-semibold text-sales-text-primary">
            {isWhatsApp ? "WhatsApp contact logged" : "Call logged"}
          </p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">Closing…</p>
        </div>
      ) : (
        <div className="space-y-4">
          {needsLeadPicker ? (
            <div>
              <label
                htmlFor="quick-log-lead"
                className="mb-1.5 block text-[12px] font-medium text-sales-text-secondary"
              >
                Lead
              </label>
              <select
                id="quick-log-lead"
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className={fieldClass}
              >
                <option value="">Select lead…</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {leadCardDisplayName(l)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {selectedLeadId ? (
            <LogCallForm
              key={`${selectedLeadId}-${defaultChannel}`}
              leadId={selectedLeadId}
              variant="compact"
              appearance="premium"
              defaultChannel={defaultChannel}
              businessType={businessType}
              clientId={selectedLead?.client_id ?? null}
              onSubmitSuccess={handleSubmitSuccess}
            />
          ) : needsLeadPicker ? (
            <p className="rounded-[10px] border border-dashed border-sales-border bg-sales-surface-hover px-4 py-6 text-center text-[13px] text-sales-text-muted">
              Choose a lead to log the outcome.
            </p>
          ) : null}
        </div>
      )}
    </PremiumSheet>
  );
}
