/**
 * Customer Deal history — active / won / lost for a contact.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getDealCommercialValue } from "./commercial-value";
import { formatDealStage, isDealClosedStage } from "./display";
import type { DealRow } from "@/types";

export type CustomerDealListItem = {
  id: string;
  name: string;
  stage: string;
  stageLabel: string;
  valueDisplay: string;
  isClosed: boolean;
  outcome: "active" | "won" | "lost";
};

export async function listDealsForContact(
  contactId: string,
  clientId: string
): Promise<CustomerDealListItem[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("contact_id", contactId)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(100);

  return ((data ?? []) as DealRow[]).map((deal) => {
    const commercial = getDealCommercialValue(deal);
    const outcome =
      deal.stage === "WON" ? "won" : deal.stage === "LOST" ? "lost" : "active";
    return {
      id: deal.id,
      name: deal.name,
      stage: deal.stage,
      stageLabel: formatDealStage(deal.stage),
      valueDisplay: commercial.display,
      isClosed: isDealClosedStage(deal.stage),
      outcome,
    };
  });
}
