"use client";

import { Switch, Select, Input } from "@/components/sales/ui";
import { SettingsSectionCard } from "./SettingsSectionCard";
import type { ProactiveConfig, ProactiveSettings } from "@/lib/agent/proactive/types";

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-sales-text-primary">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] text-sales-text-secondary">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ProactiveSettingsSection({
  value,
  onChange,
}: {
  value: ProactiveSettings;
  onChange: (next: ProactiveSettings) => void;
}) {
  const cfg = value.config;
  const patch = (partial: Partial<ProactiveSettings>) => onChange({ ...value, ...partial });
  const patchConfig = (partial: Partial<ProactiveConfig>) =>
    onChange({ ...value, config: { ...cfg, ...partial } });

  return (
    <SettingsSectionCard
      title="Proactive Agent"
      description="Let SegmiQ act when important sales events happen — even when no new customer message has arrived. Follow up quotations, remember customer commitments, remind customers about appointments and surface Deals that need attention."
    >
      <ToggleRow
        label="Proactive Agent"
        hint="Turns evaluations on. Autonomous customer messages stay off until you enable them below."
        checked={value.enabled}
        onChange={(v) => patch({ enabled: v })}
      />
      <ToggleRow
        label="Shadow mode"
        hint="Run real evaluations and show what SegmiQ would have sent. Nothing goes to the customer."
        checked={value.shadowMode}
        onChange={(v) => patch({ shadowMode: v })}
      />
      <ToggleRow
        label="Allow Agent to initiate customer messages"
        hint="Separate from responding to inbound messages. Keep off until you have reviewed Shadow mode."
        checked={value.customerMessaging}
        onChange={(v) => patch({ customerMessaging: v, shadowMode: v ? value.shadowMode : true })}
      />
      <ToggleRow
        label="Internal tasks and alerts"
        hint="Create salesperson tasks and in-app alerts when evaluations decide a person should act."
        checked={value.internalActions}
        onChange={(v) => patch({ internalActions: v })}
      />

      <div className="mt-4 border-t border-sales-border-subtle pt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
          Follow-ups · Quotations
        </p>
        <ToggleRow
          label="Quotation follow-up"
          hint="First and second follow-up timing come from Company Brain. SegmiQ re-checks current state before acting."
          checked={cfg.quoteFollowUpEnabled}
          onChange={(v) => patchConfig({ quoteFollowUpEnabled: v })}
        />
        <ToggleRow
          label="Notify salesperson before quote expiry"
          checked={cfg.quoteExpiryNotifySalesperson}
          onChange={(v) => patchConfig({ quoteExpiryNotifySalesperson: v })}
        />
        <ToggleRow
          label="Customer reminder before expiry"
          hint="Off by default. Never implies old pricing remains valid."
          checked={cfg.quoteExpiryCustomerReminder}
          onChange={(v) => patchConfig({ quoteExpiryCustomerReminder: v })}
        />
        <label className="mt-2 flex flex-col gap-1.5 text-[12px] font-medium text-sales-text-secondary">
          After maximum autonomous follow-ups
          <Select
            value={cfg.quoteAfterMaxAttempts}
            onChange={(e) =>
              patchConfig({
                quoteAfterMaxAttempts: e.target.value as ProactiveConfig["quoteAfterMaxAttempts"],
              })
            }
          >
            <option value="CREATE_TASK">Create salesperson task</option>
            <option value="NOTIFY">Notify owner</option>
            <option value="NO_ACTION">Stop quietly</option>
          </Select>
        </label>
      </div>

      <div className="mt-4 border-t border-sales-border-subtle pt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
          Deals
        </p>
        <ToggleRow
          label="Detect inactive Deals"
          hint="Uses last meaningful activity — not generic updated timestamps."
          checked={cfg.dealInactivityEnabled}
          onChange={(v) => patchConfig({ dealInactivityEnabled: v })}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-sales-text-secondary">
            Inactive after (business days)
            <Input
              type="number"
              min={1}
              max={30}
              value={cfg.dealInactivityBusinessDays}
              onChange={(e) => patchConfig({ dealInactivityBusinessDays: Number(e.target.value) || 5 })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-sales-text-secondary">
            Action
            <Select
              value={cfg.dealInactivityAction}
              onChange={(e) =>
                patchConfig({ dealInactivityAction: e.target.value as ProactiveConfig["dealInactivityAction"] })
              }
            >
              <option value="CREATE_TASK">Create task</option>
              <option value="NOTIFY">Notify</option>
              <option value="NO_ACTION">No action</option>
            </Select>
          </label>
        </div>
      </div>

      <div className="mt-4 border-t border-sales-border-subtle pt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
          Appointments
        </p>
        <ToggleRow
          label="Customer reminder"
          hint="Uses the appointment type, date and time. Never fabricates a location."
          checked={cfg.appointmentCustomerReminder}
          onChange={(v) => patchConfig({ appointmentCustomerReminder: v })}
        />
        <ToggleRow
          label="Salesperson in-app reminder"
          hint="Does not duplicate the existing T-30 WhatsApp callback reminder."
          checked={cfg.appointmentSalespersonReminder}
          onChange={(v) => patchConfig({ appointmentSalespersonReminder: v })}
        />
        <ToggleRow
          label="Missed appointment — create task"
          checked={cfg.appointmentMissedCreateTask}
          onChange={(v) => patchConfig({ appointmentMissedCreateTask: v })}
        />
        <ToggleRow
          label="Missed appointment — Agent message"
          hint="Off by default. Never accuses the customer."
          checked={cfg.appointmentMissedCustomerMessage}
          onChange={(v) => patchConfig({ appointmentMissedCustomerMessage: v })}
        />
      </div>

      <div className="mt-4 border-t border-sales-border-subtle pt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
          Response alerts · Safety
        </p>
        <ToggleRow
          label="Alert when a paused conversation is waiting"
          checked={cfg.responseSlaAlertsEnabled}
          onChange={(v) => patchConfig({ responseSlaAlertsEnabled: v })}
        />
        <p className="mt-2 text-[12px] text-sales-text-secondary">
          Contact hours default to Monday–Friday 08:00–18:00 and Saturday 09:00–13:00 in the company
          timezone. Sunday outbound is off. Follow-up timing uses Company Brain business days.
        </p>
      </div>
    </SettingsSectionCard>
  );
}
