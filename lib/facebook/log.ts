export type FbEventType =
  | "fb.oauth.started"
  | "fb.oauth.completed"
  | "fb.oauth.failed"
  | "fb.page.listed"
  | "fb.page.selected"
  | "fb.form.listed"
  | "fb.form.selected"
  | "fb.ad_account.listed"
  | "fb.ad_account.selected"
  | "fb.webhook.received"
  | "fb.webhook.leadgen_incoming"
  | "fb.webhook.verified"
  | "fb.webhook.signature_failed"
  | "fb.webhook.object_mismatch"
  | "fb.webhook.malformed"
  | "fb.webhook.unknown_field"
  | "fb.whatsapp.sent"
  | "fb.whatsapp.send_failed"
  | "fb.whatsapp.send_exception"
  | "fb.whatsapp.inbound_message"
  | "fb.whatsapp.no_client_match"
  | "fb.whatsapp.client_auto_linked"
  | "fb.whatsapp.status_update_failed"
  | "fb.whatsapp.status_no_matching_log"
  | "fb.whatsapp.status_updated"
  | "fb.webhook.no_client_match"
  | "fb.lead.fetched"
  | "fb.lead.fetch_failed"
  | "fb.lead.created"
  | "fb.lead.duplicate"
  | "fb.lead.submit_failed"
  | "fb.token.expired"
  | "fb.token.alert_sent"
  | "fb.backfill.started"
  | "fb.backfill.completed"
  | "fb.disconnect.complete";

export function fbLog(event: FbEventType, context: Record<string, unknown> = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...context,
  };

  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(entry));
  } else {
    console.log(`[${event}]`, context);
  }
}
