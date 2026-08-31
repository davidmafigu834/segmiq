"use client";

import { SegmentedControl, Switch } from "@/components/sales/ui";
import { SettingsSectionCard } from "./SettingsSectionCard";
import type { RealEstateAgentSettings } from "@/lib/agent/real-estate/types";
import { AGENT_CONVERSATION_MODE_LABELS } from "@/lib/agent/real-estate/types";

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-sales-text-primary">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] text-sales-text-secondary">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function RealEstateAgentSettingsSection({
  settings,
  agentEnabled,
  onChange,
}: {
  settings: RealEstateAgentSettings;
  agentEnabled: boolean;
  onChange: (patch: Partial<RealEstateAgentSettings>) => void;
}) {
  return (
    <SettingsSectionCard
      title="WhatsApp property agent"
      description="Controls for real-estate WhatsApp conversations. Property facts always come from listings and Company Brain — never invented."
    >
      <ToggleRow
        label="Auto-respond to new ad inquiries"
        hint="When on, SegmiQ Agent may reply to new advertising WhatsApp inquiries automatically."
        checked={settings.autoRespondAdInquiries}
        onChange={(v) => onChange({ autoRespondAdInquiries: v })}
        disabled={!agentEnabled}
      />
      <ToggleRow
        label="Allow property search"
        hint="Agent may search available listings when buyer requirements are sufficient."
        checked={settings.allowPropertySearch}
        onChange={(v) => onChange({ allowPropertySearch: v })}
        disabled={!agentEnabled}
      />
      <ToggleRow
        label="Send property information"
        hint="Agent may share verified listing details in WhatsApp."
        checked={settings.allowSendPropertyInfo}
        onChange={(v) => onChange({ allowSendPropertyInfo: v })}
        disabled={!agentEnabled}
      />
      <ToggleRow
        label="Offer viewing time slots"
        hint="Agent may suggest available viewing times when configured."
        checked={settings.allowOfferViewingSlots}
        onChange={(v) => onChange({ allowOfferViewingSlots: v })}
        disabled={!agentEnabled}
      />
      <ToggleRow
        label="Confirm viewings automatically"
        hint="When off, viewing requests need agent approval before the customer is confirmed."
        checked={settings.allowConfirmViewings}
        onChange={(v) => onChange({ allowConfirmViewings: v })}
        disabled={!agentEnabled}
      />
      <ToggleRow
        label="Require approval before proposing appointments"
        hint="Recommended for V1. Agent notifies the agent instead of confirming directly."
        checked={settings.requireViewingApproval}
        onChange={(v) => onChange({ requireViewingApproval: v })}
        disabled={!agentEnabled}
      />
      <ToggleRow
        label="Update buyer requirements"
        hint="Agent may write structured budget, area, and bedroom preferences to CRM."
        checked={settings.allowUpdateBuyerRequirements}
        onChange={(v) => onChange({ allowUpdateBuyerRequirements: v })}
        disabled={!agentEnabled}
      />
      <ToggleRow
        label="Create follow-ups"
        hint="Agent may schedule follow-up tasks when appropriate."
        checked={settings.allowCreateFollowups}
        onChange={(v) => onChange({ allowCreateFollowups: v })}
        disabled={!agentEnabled}
      />
      <div className="border-t border-sales-border-subtle pt-4 mt-2">
        <p className="text-[12px] font-medium text-sales-text-primary">Default conversation mode</p>
        <p className="mt-0.5 mb-3 text-[12px] text-sales-text-secondary">
          How new WhatsApp inquiries start. Salespeople can change mode per conversation in the inbox.
        </p>
        <SegmentedControl
          value={settings.defaultConversationMode}
          onChange={(v) => {
            if (!agentEnabled) return;
            onChange({
              defaultConversationMode: v as RealEstateAgentSettings["defaultConversationMode"],
            });
          }}
          options={(
            ["AI_HANDLING", "AI_COPILOT", "HUMAN_ONLY"] as const
          ).map((mode) => ({
            value: mode,
            label: AGENT_CONVERSATION_MODE_LABELS[mode],
          }))}
        />
      </div>
    </SettingsSectionCard>
  );
}
