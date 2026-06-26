import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { LogCallForm } from "./LogCallForm";
import type { LeadRow } from "../lib/types";
import { leadDisplayName } from "../lib/format";

type Props = {
  open: boolean;
  leads: LeadRow[];
  initialLeadId?: string;
  initialChannel?: "call" | "whatsapp";
  online: boolean;
  onClose: () => void;
  onLogged: (lead?: LeadRow) => void;
};

export function LogCallSheet({
  open,
  leads,
  initialLeadId,
  initialChannel = "call",
  online,
  onClose,
  onLogged,
}: Props) {
  const [leadId, setLeadId] = useState(initialLeadId ?? "");

  useEffect(() => {
    if (open) setLeadId(initialLeadId ?? leads[0]?.id ?? "");
  }, [open, initialLeadId, leads]);

  const selectedLead = leads.find((l) => l.id === leadId) ?? null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/70">
      <button type="button" className="flex-1" aria-label="Close" onClick={onClose} />
      <div className="safe-bottom max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-border bg-bg-secondary px-5 pb-6 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-ink-primary">Log call</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-tertiary text-ink-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {leads.length > 1 ? (
          <>
            <label className="mb-1 block text-[13px] font-medium text-ink-secondary">Lead</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="mb-4 w-full rounded-xl border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none focus:border-border-focus"
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {leadDisplayName(l.name)}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {selectedLead ? (
          <LogCallForm
            lead={selectedLead}
            defaultChannel={initialChannel}
            online={online}
            variant="sheet"
            onLogged={(lead) => {
              onLogged(lead);
              onClose();
            }}
          />
        ) : (
          <p className="text-[14px] text-ink-tertiary">No lead selected</p>
        )}
      </div>
    </div>
  );
}
