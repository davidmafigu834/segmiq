import { NextResponse } from "next/server";
import { z } from "zod";
import { canModifyLead } from "@/lib/auth/permissions";
import { canManageQuotationForLead } from "@/lib/quotations/quote-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftFingerprint } from "@/lib/sales-copilot/catalogue";
import { payloadHash } from "@/lib/sales-copilot/hash";
import { runCopilotAnalysis } from "@/lib/sales-copilot/runtime";
import { prepareQuotationDraft, quotationReadyCopy, executeWorkItem } from "@/lib/sales-copilot/execute";
import { appendAudit, claimWorkItem, getWorkItem, toPublicItem } from "@/lib/sales-copilot/store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["approve", "dismiss", "snooze", "retry", "complete", "choose"]),
  proposedAt: z.string().min(8).optional(),
  snoozeUntil: z.string().min(8).optional(),
  productId: z.string().uuid().optional(),
});

const QUOTE_ACTIONS = new Set(["quotation_draft", "quotation_choice", "quotation_missing", "send_quotation"]);

export async function POST(req: Request, { params }: { params: { itemId: string } }) {
  const item = await getWorkItem(params.itemId).catch(() => null);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quoteAction = QUOTE_ACTIONS.has(item.action_type);
  const access = quoteAction
    ? await canManageQuotationForLead(item.lead_id, req)
    : await canModifyLead(item.lead_id, req);
  if (!access.allowed) {
    const status = access.status === 401 ? 401 : access.status === 404 ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? "Not found" : "Forbidden" }, { status });
  }
  const actorId = "userId" in access ? access.userId : access.actor.id;
  const actorName = "actor" in access ? access.actor.name : "Salesperson";

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const body = parsed.data;

  if (body.action === "dismiss") {
    await appendAudit(item.id, { at: new Date().toISOString(), actorId, action: "dismiss" }, {
      review_status: "dismissed",
    });
    const next = await getWorkItem(item.id);
    return NextResponse.json({ item: next ? toPublicItem(next) : null });
  }

  if (body.action === "snooze") {
    if (!body.snoozeUntil) return NextResponse.json({ error: "Choose when to show this again." }, { status: 400 });
    await appendAudit(item.id, { at: new Date().toISOString(), actorId, action: "snooze" }, {
      review_status: "snoozed",
      snooze_until: body.snoozeUntil,
    });
    const next = await getWorkItem(item.id);
    return NextResponse.json({ item: next ? toPublicItem(next) : null });
  }

  if (body.action === "complete") {
    if (item.linked_follow_up) {
      const supabase = createAdminClient();
      await supabase
        .from("leads")
        .update({ follow_up_date: null, follow_up_source: null, updated_at: new Date().toISOString() })
        .eq("id", item.lead_id)
        .eq("client_id", item.client_id);
    }
    if (item.action_type === "send_quotation") {
      const supabase = createAdminClient();
      const { data: quote } = await supabase
        .from("quotations")
        .select("status")
        .eq("id", item.linked_quotation_id ?? "")
        .maybeSingle();
      if (!quote || quote.status === "draft") {
        return NextResponse.json(
          { error: "Send the quotation from the draft page. Completing this task does not send it." },
          { status: 409 }
        );
      }
    }
    await appendAudit(item.id, { at: new Date().toISOString(), actorId, action: "complete" }, {
      fulfilment_status: "fulfilled",
      execution_status: item.execution_status === "failed" ? "failed" : "succeeded",
    });
    const next = await getWorkItem(item.id);
    return NextResponse.json({ item: next ? toPublicItem(next) : null });
  }

  if (body.action === "choose") {
    if (!body.productId) return NextResponse.json({ error: "Choose one of the matches." }, { status: 400 });
    const options = Array.isArray(item.proposed_payload.options) ? item.proposed_payload.options : [];
    const chosen = options.find((option) => (option as { id?: string }).id === body.productId) as
      | { id: string; name?: string; unitPrice?: number | null }
      | undefined;
    if (!chosen) return NextResponse.json({ error: "That option is not one of the matches." }, { status: 400 });
    const kind = String(item.proposed_payload.kind ?? item.action_type);
    if (kind === "listing_shortlist" || item.action_type === "listing_shortlist") {
      await appendAudit(item.id, { at: new Date().toISOString(), actorId, action: "choose_listing" }, {
        action_type: "appointment",
        title: "Viewing needs a time",
        explanation: `You chose ${chosen.name ?? "this listing"}. Choose a time to save a follow-up. No appointment was created.`,
        missing_information: ["Preferred viewing time"],
        review_status: "pending",
        execution_status: "none",
        execution_error: null,
        proposed_payload: {
          ...item.proposed_payload,
          kind: "appointment",
          listingId: chosen.id,
          listingName: chosen.name ?? null,
          chosenId: chosen.id,
          salespersonChoice: true,
        },
      });
      const next = await getWorkItem(item.id);
      return NextResponse.json({ item: next ? toPublicItem(next) : null });
    }
    const quantity = Number(item.proposed_payload.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Quantity is still needed, so a draft was not created." }, { status: 409 });
    }
    if (chosen.unitPrice == null) {
      return NextResponse.json({ error: "That product has no catalogue price, so a draft was not created." }, { status: 409 });
    }
    try {
      const line = {
        productId: chosen.id,
        name: chosen.name ?? "Item",
        quantity,
        unitPrice: Number(chosen.unitPrice),
      };
      const saved = await prepareQuotationDraft({
        clientId: item.client_id,
        leadId: item.lead_id,
        dealId: item.deal_id,
        actorId,
        actorName,
        lines: [line],
        fingerprint: draftFingerprint([line]),
      });
      const copy = quotationReadyCopy();
      await appendAudit(item.id, { at: new Date().toISOString(), actorId, action: "choose" }, {
        action_type: "quotation_draft",
        title: copy.title,
        explanation: copy.explanation,
        linked_quotation_id: saved.quotationId,
        execution_status: "succeeded",
        review_status: "pending",
        execution_error: null,
        proposed_payload: {
          ...item.proposed_payload,
          kind: "quotation_draft",
          quotationId: saved.quotationId,
          chosenId: chosen.id,
          salespersonChoice: true,
          items: [line],
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The draft was not saved.";
      await appendAudit(item.id, { at: new Date().toISOString(), actorId, action: "choose_failed" }, {
        execution_status: "failed",
        review_status: "approved",
        execution_error: message,
        title: "Quotation draft was not saved",
        explanation: message,
      });
      return NextResponse.json({ error: message }, { status: 409 });
    }
    const next = await getWorkItem(item.id);
    return NextResponse.json({ item: next ? toPublicItem(next) : null });
  }

  if (body.action === "approve" || body.action === "retry") {
    if (item.review_status === "stale" || item.review_status === "dismissed") {
      return NextResponse.json({ error: "This suggestion is out of date.", code: "stale" }, { status: 409 });
    }
    if (item.action_type === "listing_shortlist" || item.action_type === "quotation_choice") {
      return NextResponse.json(
        {
          error:
            item.action_type === "listing_shortlist"
              ? "Choose a listing first. Nothing was shortlisted."
              : "Choose a product before a draft is prepared.",
        },
        { status: 400 }
      );
    }
    if (item.action_type === "quotation_missing") {
      return NextResponse.json({ error: "Required details are still missing. Nothing was created." }, { status: 400 });
    }
    if (item.action_type === "appointment" && !(body.proposedAt || item.proposed_at)) {
      return NextResponse.json({ error: "Choose a viewing time. No appointment was created." }, { status: 400 });
    }
  }

  const pinnedChoice = item.proposed_payload.salespersonChoice === true;
  const preview = pinnedChoice
    ? null
    : await runCopilotAnalysis(item.client_id, item.lead_id, { enrich: false, persist: false });
  const fresh = preview?.proposals.find((proposal) => proposal.semanticKey === item.semantic_key);
  if (!fresh && !pinnedChoice) {
    await appendAudit(item.id, { at: new Date().toISOString(), actorId, action: "obsolete" }, {
      fulfilment_status: "obsolete",
    });
    return NextResponse.json({ error: "This suggestion is out of date.", code: "stale" }, { status: 409 });
  }
  const freshHash = fresh
    ? payloadHash({
        actionType: fresh.actionType,
        proposedAt: fresh.proposedAt,
        payload: fresh.payload,
        missing: fresh.missing,
      })
    : null;
  const dateEdited = Boolean(body.proposedAt);
  if (!pinnedChoice && freshHash && !dateEdited && freshHash !== item.payload_hash && body.action !== "retry") {
    await appendAudit(item.id, { at: new Date().toISOString(), actorId, action: "stale" }, {
      review_status: "stale",
    });
    return NextResponse.json(
      { error: "The conversation changed. Review the updated suggestion before continuing.", code: "stale" },
      { status: 409 }
    );
  }

  if (
    body.action === "approve" &&
    item.action_type === "quotation_draft" &&
    item.linked_quotation_id &&
    item.execution_status === "succeeded"
  ) {
    return NextResponse.json({ item: toPublicItem(item) });
  }

  const claimed = await claimWorkItem(item.id, body.action === "retry" ? "retry" : "approve");
  if (!claimed) {
    const current = await getWorkItem(item.id);
    if (current?.execution_status === "succeeded") return NextResponse.json({ item: toPublicItem(current) });
    return NextResponse.json({ error: "This suggestion is already being handled." }, { status: 409 });
  }
  const result = await executeWorkItem({
    item: { ...claimed, proposed_at: body.proposedAt ?? claimed.proposed_at },
    actorId,
    actorName,
    followUpAt: body.proposedAt ?? claimed.proposed_at,
  });
  const next = await getWorkItem(item.id);
  if (!result.ok) return NextResponse.json({ error: result.error, item: next ? toPublicItem(next) : null }, { status: 409 });
  return NextResponse.json({ item: next ? toPublicItem(next) : null, result });
}
