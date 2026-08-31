import type { AgentConversationMode, RealEstateAgentSettings } from "./types";
import { REAL_ESTATE_AGENT_SETTINGS_DEFAULTS } from "./types";
import type { AgentCompanySettings } from "../types";

type SettingsRow = Record<string, unknown>;

export function realEstateSettingsFromRow(row: SettingsRow | null): RealEstateAgentSettings {
  const d = REAL_ESTATE_AGENT_SETTINGS_DEFAULTS;
  if (!row) return { ...d };
  const bool = (key: string, fallback: boolean) =>
    typeof row[key] === "boolean" ? (row[key] as boolean) : fallback;
  const mode = row.re_default_conversation_mode;
  const defaultConversationMode =
    mode === "AI_COPILOT" || mode === "HUMAN_ONLY" || mode === "AI_HANDLING"
      ? mode
      : d.defaultConversationMode;
  return {
    autoRespondAdInquiries: bool("re_auto_respond_ad_inquiries", d.autoRespondAdInquiries),
    allowPropertySearch: bool("re_allow_property_search", d.allowPropertySearch),
    allowSendPropertyInfo: bool("re_allow_send_property_info", d.allowSendPropertyInfo),
    allowOfferViewingSlots: bool("re_allow_offer_viewing_slots", d.allowOfferViewingSlots),
    allowConfirmViewings: bool("re_allow_confirm_viewings", d.allowConfirmViewings),
    requireViewingApproval: bool("re_require_viewing_approval", d.requireViewingApproval),
    allowUpdateBuyerRequirements: bool(
      "re_allow_update_buyer_requirements",
      d.allowUpdateBuyerRequirements
    ),
    allowCreateFollowups: bool("re_allow_create_followups", d.allowCreateFollowups),
    defaultConversationMode,
  };
}

export function realEstateSettingsPatchToColumns(
  patch: Partial<RealEstateAgentSettings>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.autoRespondAdInquiries !== undefined) {
    out.re_auto_respond_ad_inquiries = patch.autoRespondAdInquiries;
  }
  if (patch.allowPropertySearch !== undefined) out.re_allow_property_search = patch.allowPropertySearch;
  if (patch.allowSendPropertyInfo !== undefined) {
    out.re_allow_send_property_info = patch.allowSendPropertyInfo;
  }
  if (patch.allowOfferViewingSlots !== undefined) {
    out.re_allow_offer_viewing_slots = patch.allowOfferViewingSlots;
  }
  if (patch.allowConfirmViewings !== undefined) {
    out.re_allow_confirm_viewings = patch.allowConfirmViewings;
  }
  if (patch.requireViewingApproval !== undefined) {
    out.re_require_viewing_approval = patch.requireViewingApproval;
  }
  if (patch.allowUpdateBuyerRequirements !== undefined) {
    out.re_allow_update_buyer_requirements = patch.allowUpdateBuyerRequirements;
  }
  if (patch.allowCreateFollowups !== undefined) {
    out.re_allow_create_followups = patch.allowCreateFollowups;
  }
  if (patch.defaultConversationMode !== undefined) {
    out.re_default_conversation_mode = patch.defaultConversationMode;
  }
  return out;
}

export function mergeRealEstateIntoAgentSettings(
  settings: AgentCompanySettings,
  row: SettingsRow | null
): AgentCompanySettings {
  return { ...settings, realEstate: realEstateSettingsFromRow(row) };
}

export function defaultConversationModeForNewThread(
  settings: AgentCompanySettings
): AgentConversationMode {
  return settings.realEstate?.defaultConversationMode ?? "AI_HANDLING";
}
