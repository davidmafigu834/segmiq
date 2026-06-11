/** Client row fields used to pick one client when a Page + Lead Form pair matches multiple rows. */
export type LeadgenWebhookClientRow = {
  id: string;
  fb_access_token: string;
  is_active?: boolean | null;
  is_archived?: boolean | null;
  created_at?: string | null;
};

/**
 * Meta webhooks identify leads by page_id + form_id. Only one client should own that pair;
 * when duplicates exist (e.g. re-onboarded client), prefer the active, non-archived client,
 * then the most recently created row.
 */
export function pickClientForLeadgenWebhook(
  clients: LeadgenWebhookClientRow[]
): LeadgenWebhookClientRow | null {
  if (!clients.length) return null;

  const eligible = clients.filter((c) => c.is_active !== false && c.is_archived !== true);
  const pool = eligible.length > 0 ? eligible : clients;

  return [...pool].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    return tb - ta;
  })[0] ?? null;
}
