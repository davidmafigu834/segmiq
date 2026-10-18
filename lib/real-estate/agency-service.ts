import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAgencyManager, sameOrganisation } from "@/lib/real-estate/deal-access";
import {
  allocateCommission,
  agencyAttention,
  canApproveCommission,
  canSeeTransactionDocument,
  canVerifyCommissionReceipt,
  capabilitiesForRole,
  commissionActionBlocked,
  commissionActionPermitted,
  commissionAfterTransactionFailure,
  commissionTotals,
  cumulativePatch,
  decimalToCents,
  documentDecisionError,
  documentReviewAfterUpload,
  grossCommissionCents,
  handoverDrift,
  handoverRecordKey,
  planHandover,
  payoutProgress,
  statusAfterAction,
  visibleDealSlice,
  type AgencyCapability,
  type AllocationLine,
  type CommissionAction,
  type CommissionStatus,
  type DocumentDecision,
  type HandoverAssignment,
  type ParticipantRole,
} from "@/lib/real-estate/agency-operations";
import { chunk, readAllPages } from "@/lib/real-estate/paging";

export type AgencyActor = { id: string; name: string; role: string; clientId: string | null };

type Fail = { ok: false; error: string; status: number };

function fail(error: string, status: number): Fail {
  return { ok: false, error, status };
}

function missing(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "42P01" || error?.code === "42703" || /does not exist|schema cache/i.test(message);
}

function migrationFail(error: { message?: string; code?: string } | null, fallback: string): Fail {
  if (missing(error)) return fail("Apply the real estate Phase 4 and final corrections migrations first.", 503);
  return fail(error?.message ?? fallback, 500);
}

function allowed(actor: AgencyActor, clientId: string): boolean {
  return actor.role === "SUPER_ADMIN" || sameOrganisation(actor.clientId, clientId);
}

function cents(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

type OrgUser = { id: string; name: string; role: string; is_active: boolean };

async function orgUser(clientId: string, userId: string | null | undefined): Promise<OrgUser | null> {
  if (!userId) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, name, role, is_active")
    .eq("id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    name: (data.name as string | null) ?? "Team member",
    role: (data.role as string | null) ?? "SALESPERSON",
    is_active: data.is_active !== false,
  };
}

/** Active team members for pickers. Names and roles only; no contact details. */
export async function staffDirectory(clientId: string, actor: AgencyActor) {
  if (!allowed(actor, clientId)) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, role")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .in("role", ["SALESPERSON", "CLIENT_MANAGER"])
    .order("name", { ascending: true });
  if (error) return fail(error.message, 500);
  return {
    ok: true as const,
    staff: (data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as string | null) ?? "Team member",
      role: row.role as string,
    })),
  };
}

export async function staffCapabilities(clientId: string, userId: string, role: string): Promise<AgencyCapability[]> {
  const base = new Set(capabilitiesForRole(role));
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_staff_capabilities")
    .select("capability")
    .eq("client_id", clientId)
    .eq("user_id", userId);
  if (error) return [...base];
  for (const row of data ?? []) base.add(row.capability as AgencyCapability);
  return [...base];
}

function isFinance(actor: AgencyActor, caps: readonly string[]): boolean {
  return isAgencyManager(actor.role) || caps.includes("approve_commission") || caps.includes("confirm_payment");
}

export async function grantCapability(input: {
  clientId: string;
  actor: AgencyActor;
  userId: string;
  capability: AgencyCapability;
}) {
  if (!allowed(input.actor, input.clientId) || !isAgencyManager(input.actor.role)) return fail("Forbidden.", 403);
  if (!(await orgUser(input.clientId, input.userId))) return fail("That person is not in this organisation.", 404);
  const supabase = createAdminClient();
  const { error } = await supabase.from("real_estate_staff_capabilities").upsert(
    { client_id: input.clientId, user_id: input.userId, capability: input.capability, granted_by: input.actor.id },
    { onConflict: "client_id,user_id,capability" }
  );
  if (error) return migrationFail(error, "Could not save the permission.");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Commission templates and setup
// ---------------------------------------------------------------------------

export async function createCommissionTemplate(input: {
  clientId: string;
  actor: AgencyActor;
  name: string;
  transactionType: "sale" | "rental";
  mode: "percent" | "fixed";
  basisPoints?: number | null;
  fixedCents?: number | null;
  currency?: string;
  notes?: string | null;
}) {
  if (!isAgencyManager(input.actor.role) || !allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  if (input.mode === "percent" && (input.basisPoints == null || input.basisPoints < 0)) {
    return fail("A percentage template needs a rate.", 400);
  }
  if (input.mode === "fixed" && (input.fixedCents == null || input.fixedCents < 0)) {
    return fail("A fixed template needs an amount.", 400);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_commission_templates")
    .insert({
      client_id: input.clientId,
      name: input.name.trim(),
      transaction_type: input.transactionType,
      mode: input.mode,
      basis_points: input.basisPoints ?? null,
      fixed_cents: input.fixedCents ?? null,
      currency: (input.currency || "USD").toUpperCase(),
      notes: input.notes ?? null,
      created_by: input.actor.id,
    })
    .select("*")
    .single();
  if (error || !data) return migrationFail(error, "Could not save the template.");
  return { ok: true as const, template: data };
}

/**
 * Everything the allocation form needs: basis in cents, templates, eligible
 * beneficiaries with their current share, and the deal's participants.
 */
export async function commissionSetup(clientId: string, actor: AgencyActor, transactionId: string) {
  if (!allowed(actor, clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(clientId, actor.id, actor.role);
  if (!isAgencyManager(actor.role) && !caps.includes("approve_commission")) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data: txn } = await supabase
    .from("real_estate_transactions")
    .select("id, transaction_type, agreed_price, currency, listing_agent_id, buyer_agent_id, listing_id, status")
    .eq("id", transactionId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!txn) return fail("Transaction not found.", 404);
  const templateType = txn.transaction_type === "rental" || txn.transaction_type === "property_management" ? "rental" : "sale";
  const [templates, staff, participants, commissions] = await Promise.all([
    supabase
      .from("real_estate_commission_templates")
      .select("id, name, mode, basis_points, fixed_cents, currency, notes")
      .eq("client_id", clientId)
      .eq("transaction_type", templateType)
      .order("created_at", { ascending: false }),
    staffDirectory(clientId, actor),
    supabase
      .from("real_estate_deal_participants")
      .select("user_id, participant_role, ended_at")
      .eq("client_id", clientId)
      .eq("transaction_id", transactionId),
    supabase
      .from("real_estate_commissions")
      .select("id, status, provenance")
      .eq("client_id", clientId)
      .eq("transaction_id", transactionId),
  ]);
  const liveCommissionIds = (commissions.data ?? [])
    .filter((row) => row.status !== "cancelled")
    .map((row) => row.id as string);
  const { data: lines } = liveCommissionIds.length
    ? await supabase
        .from("real_estate_commission_allocations")
        .select("beneficiary_id, amount_cents, approval_status, commission_id")
        .eq("client_id", clientId)
        .in("commission_id", liveCommissionIds)
    : { data: [] as Array<Record<string, unknown>> };
  const currentShare = new Map<string, number>();
  for (const line of lines ?? []) {
    if (line.approval_status === "superseded" || line.approval_status === "rejected") continue;
    const id = line.beneficiary_id as string | null;
    if (!id) continue;
    currentShare.set(id, (currentShare.get(id) ?? 0) + cents(line.amount_cents));
  }
  const roleHints = new Map<string, string[]>();
  const hint = (id: string | null | undefined, label: string) => {
    if (!id) return;
    roleHints.set(id, [...(roleHints.get(id) ?? []), label]);
  };
  hint(txn.listing_agent_id as string | null, "listing_agent");
  hint(txn.buyer_agent_id as string | null, "buyer_agent");
  for (const row of participants.data ?? []) {
    if (row.ended_at) continue;
    hint(row.user_id as string | null, row.participant_role as string);
  }
  const team = staff.ok ? staff.staff : [];
  return {
    ok: true as const,
    transaction: {
      id: txn.id as string,
      type: txn.transaction_type as string,
      status: txn.status as string,
      currency: (txn.currency as string | null) ?? "USD",
      basisCents: decimalToCents(txn.agreed_price as string | number | null),
    },
    templates: templates.data ?? [],
    existingCommissions: (commissions.data ?? []).map((row) => ({
      id: row.id as string,
      status: row.status as string,
      provenance: row.provenance as string,
    })),
    beneficiaries: team.map((member) => ({
      ...member,
      dealRoles: roleHints.get(member.id) ?? [],
      currentAllocationCents: currentShare.get(member.id) ?? 0,
      eligible: true,
    })),
  };
}

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

export async function createCommission(input: {
  clientId: string;
  actor: AgencyActor;
  transactionId: string;
  basisCents: number;
  mode: "percent" | "fixed";
  basisPoints?: number | null;
  fixedCents?: number | null;
  currency?: string;
  templateId?: string | null;
  lines: AllocationLine[];
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  if (!isAgencyManager(input.actor.role) && !caps.includes("approve_commission")) return fail("Forbidden.", 403);
  const supabase = createAdminClient();

  let mode = input.mode;
  let basisPoints = input.basisPoints ?? null;
  let fixedCents = input.fixedCents ?? null;
  if (input.templateId) {
    const { data: template } = await supabase
      .from("real_estate_commission_templates")
      .select("mode, basis_points, fixed_cents")
      .eq("id", input.templateId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!template) return fail("Commission template not found.", 404);
    mode = template.mode as "percent" | "fixed";
    basisPoints = (template.basis_points as number | null) ?? null;
    fixedCents = template.fixed_cents == null ? null : cents(template.fixed_cents);
  }

  let gross = 0;
  try {
    gross = grossCommissionCents({ basisCents: input.basisCents, mode, basisPoints, fixedCents });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid commission.", 400);
  }
  const seen = new Set<string>();
  for (const line of input.lines) {
    const key = `${line.beneficiaryId}:${line.role}`;
    if (seen.has(key)) return fail("Each person can appear once per role.", 400);
    seen.add(key);
    const member = await orgUser(input.clientId, line.beneficiaryId);
    if (!member) return fail("Every beneficiary must be a member of this organisation.", 400);
  }
  const allocation = allocateCommission({ distributableCents: gross, lines: input.lines });
  if (!allocation.ok) return fail(allocation.error, 400);

  const { data: txn } = await supabase
    .from("real_estate_transactions")
    .select("id")
    .eq("id", input.transactionId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!txn) return fail("Transaction not found.", 404);
  const { data: active } = await supabase
    .from("real_estate_commissions")
    .select("id, status, provenance")
    .eq("client_id", input.clientId)
    .eq("transaction_id", input.transactionId)
    .neq("status", "cancelled");
  if ((active ?? []).some((row) => row.provenance !== "legacy_transaction_fields")) {
    return fail("This transaction already has a commission. Adjust it through a dispute or cancel it first.", 409);
  }

  const { data, error } = await supabase
    .from("real_estate_commissions")
    .insert({
      client_id: input.clientId,
      transaction_id: input.transactionId,
      template_id: input.templateId ?? null,
      basis_cents: input.basisCents,
      mode,
      basis_points: basisPoints,
      fixed_cents: fixedCents,
      gross_cents: gross,
      currency: (input.currency || "USD").toUpperCase(),
      status: "projected",
      provenance: "agent",
      created_by: input.actor.id,
    })
    .select("*")
    .single();
  if (error || !data) return migrationFail(error, "Could not create the commission.");
  const { error: lineError } = await supabase.from("real_estate_commission_allocations").insert(
    allocation.lines.map((line) => {
      const source = input.lines.find((item) => item.id === line.id);
      return {
        client_id: input.clientId,
        commission_id: data.id,
        beneficiary_id: line.beneficiaryId,
        participant_role: line.role,
        mode: source?.mode ?? "fixed",
        basis_points: source?.basisPoints ?? null,
        fixed_cents: source?.fixedCents ?? null,
        amount_cents: line.cents,
        absorbs_remainder: Boolean(source?.absorbsRemainder),
      };
    })
  );
  if (lineError) {
    await supabase.from("real_estate_commissions").delete().eq("id", data.id).eq("client_id", input.clientId);
    return fail(lineError.message, 500);
  }
  await supabase.from("real_estate_commission_events").insert({
    client_id: input.clientId,
    commission_id: data.id,
    event_type: "commission_projected",
    amount_cents: gross,
    actor_id: input.actor.id,
    note: `Projected from the agreed basis. Unallocated remainder ${allocation.remainderCents} cents. This is not cash received.`,
  });
  return { ok: true as const, commission: data, allocations: allocation.lines, remainderCents: allocation.remainderCents };
}

async function loadCommission(clientId: string, commissionId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("real_estate_commissions")
    .select("*")
    .eq("id", commissionId)
    .eq("client_id", clientId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

async function commissionBeneficiaries(clientId: string, commissionId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("real_estate_commission_allocations")
    .select("beneficiary_id, approval_status")
    .eq("client_id", clientId)
    .eq("commission_id", commissionId);
  return new Set(
    (data ?? [])
      .filter((row) => row.approval_status !== "superseded")
      .map((row) => row.beneficiary_id as string | null)
      .filter((id): id is string => Boolean(id))
  );
}

export async function updateCommissionStatus(input: {
  clientId: string;
  actor: AgencyActor;
  commissionId: string;
  action: CommissionAction;
  note?: string | null;
  amountCents?: number | null;
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const row = await loadCommission(input.clientId, input.commissionId);
  if (!row) return fail("Commission not found.", 404);
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  const beneficiaries = await commissionBeneficiaries(input.clientId, input.commissionId);
  if (
    !commissionActionPermitted({
      action: input.action,
      role: input.actor.role,
      capabilities: caps,
      isBeneficiary: beneficiaries.has(input.actor.id),
    })
  ) {
    return fail(input.action === "verify_receipt" ? "Only an authorised user can verify receipt." : "Forbidden.", 403);
  }
  const current = row.status as CommissionStatus;
  const blocked = commissionActionBlocked(current, input.action);
  if (blocked) return fail(blocked, 409);
  if (input.amountCents != null && (!Number.isInteger(input.amountCents) || input.amountCents <= 0)) {
    return fail("Amounts are positive whole cents.", 400);
  }
  const gross = cents(row.gross_cents);
  const verifiedSoFar = cents(row.verified_received_cents);
  if (input.action === "verify_receipt") {
    const amount = input.amountCents ?? Math.max(0, gross - verifiedSoFar);
    if (amount <= 0) return fail("The full commission is already verified as received.", 409);
    if (verifiedSoFar + amount > gross) return fail("Verified receipts cannot exceed the commission.", 400);
  }

  const supabase = createAdminClient();
  if (input.action === "approve_allocations") {
    const { data: lines } = await supabase
      .from("real_estate_commission_allocations")
      .select("id, beneficiary_id, approval_status")
      .eq("commission_id", input.commissionId)
      .eq("client_id", input.clientId)
      .eq("approval_status", "pending");
    if (!(lines ?? []).length) return fail("There are no pending allocations to approve.", 409);
    for (const line of lines ?? []) {
      if (
        !canApproveCommission({
          actorId: input.actor.id,
          beneficiaryId: (line.beneficiary_id as string | null) ?? "",
          role: input.actor.role,
          capabilities: caps,
        })
      ) {
        return fail("You cannot approve an allocation that pays you. Ask another authorised person.", 403);
      }
    }
    const now = new Date().toISOString();
    const approve = await supabase
      .from("real_estate_commission_allocations")
      .update({ approval_status: "approved", approved_by: input.actor.id, approved_at: now })
      .eq("commission_id", input.commissionId)
      .eq("client_id", input.clientId)
      .eq("approval_status", "pending");
    if (approve.error) {
      if (!missing(approve.error)) return fail(approve.error.message, 500);
      await supabase
        .from("real_estate_commission_allocations")
        .update({ approval_status: "approved", approved_by: input.actor.id })
        .eq("commission_id", input.commissionId)
        .eq("client_id", input.clientId)
        .eq("approval_status", "pending");
    }
  }

  const nowIso = new Date().toISOString();
  const status = statusAfterAction(current, input.action);
  const cumulative = cumulativePatch({
    action: input.action,
    grossCents: gross,
    amountCents: input.amountCents ?? (input.action === "verify_receipt" ? gross - verifiedSoFar : null),
    current: {
      earnedCents: cents(row.earned_cents),
      invoicedCents: cents(row.invoiced_cents),
      reportedReceivedCents: cents(row.reported_received_cents),
      verifiedReceivedCents: verifiedSoFar,
    },
    nowIso,
  });
  const patch: Record<string, unknown> = { status, updated_at: nowIso, ...cumulative };
  if (input.action === "verify_receipt") patch.verified_received_by = input.actor.id;
  if (input.action === "cancel") patch.cancelled_at = nowIso;
  let result = await supabase
    .from("real_estate_commissions")
    .update(patch)
    .eq("id", input.commissionId)
    .eq("client_id", input.clientId)
    .eq("status", current)
    .select("*")
    .maybeSingle();
  if (result.error && missing(result.error)) {
    result = await supabase
      .from("real_estate_commissions")
      .update({ status, updated_at: nowIso })
      .eq("id", input.commissionId)
      .eq("client_id", input.clientId)
      .eq("status", current)
      .select("*")
      .maybeSingle();
  }
  if (result.error) return fail(result.error.message, 500);
  if (!result.data) return fail("This commission changed while you were working. Refresh and try again.", 409);
  await supabase.from("real_estate_commission_events").insert({
    client_id: input.clientId,
    commission_id: input.commissionId,
    event_type: input.action,
    from_value: current,
    to_value: status,
    amount_cents:
      input.action === "verify_receipt" || input.action === "report_receipt"
        ? input.amountCents ?? (input.action === "verify_receipt" ? gross - verifiedSoFar : gross)
        : null,
    note: input.note ?? null,
    actor_id: input.actor.id,
  });
  return { ok: true as const, commission: result.data };
}

export async function recordAllocationPayout(input: {
  clientId: string;
  actor: AgencyActor;
  allocationId: string;
  payoutCents: number;
  reference?: string | null;
  verify: boolean;
  payoutId?: string | null;
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  if (!Number.isInteger(input.payoutCents) || input.payoutCents <= 0) {
    return fail("Payout amount must be a positive number of cents.", 400);
  }
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  const supabase = createAdminClient();
  const { data: line } = await supabase
    .from("real_estate_commission_allocations")
    .select("*")
    .eq("id", input.allocationId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!line) return fail("Allocation not found.", 404);
  const beneficiaryId = (line.beneficiary_id as string | null) ?? "";
  const isBeneficiary = beneficiaryId === input.actor.id;
  const finance = isFinance(input.actor, caps);
  if (line.approval_status === "superseded" || line.approval_status === "rejected") {
    return fail("This allocation is no longer current.", 409);
  }

  if (!input.verify) {
    if (!finance && !isBeneficiary) return fail("Forbidden.", 403);
    const reported = cents(line.reported_payout_cents) + input.payoutCents;
    const update = await supabase
      .from("real_estate_commission_allocations")
      .update({
        reported_payout_cents: reported,
        payout_status: line.payout_status === "unpaid" ? "reported" : line.payout_status,
        payment_reference: input.reference ?? line.payment_reference,
      })
      .eq("id", input.allocationId)
      .eq("client_id", input.clientId);
    if (update.error && !missing(update.error)) return fail(update.error.message, 500);
    if (update.error) {
      await supabase
        .from("real_estate_commission_allocations")
        .update({ payout_status: line.payout_status === "unpaid" ? "reported" : line.payout_status })
        .eq("id", input.allocationId)
        .eq("client_id", input.clientId);
    }
    const history = await supabase.from("real_estate_commission_payouts").insert({
      client_id: input.clientId,
      commission_id: line.commission_id,
      allocation_id: input.allocationId,
      amount_cents: input.payoutCents,
      status: "reported",
      reference: input.reference ?? null,
      reported_by: input.actor.id,
    });
    if (history.error && !missing(history.error)) console.error("[commission-payout]", history.error.message);
    await supabase.from("real_estate_commission_events").insert({
      client_id: input.clientId,
      commission_id: line.commission_id,
      allocation_id: input.allocationId,
      event_type: "payout_reported",
      amount_cents: input.payoutCents,
      actor_id: input.actor.id,
      note: input.reference ?? "Reported. Not verified.",
    });
    return { ok: true as const, payoutStatus: "reported" as const };
  }

  if (!canVerifyCommissionReceipt({ role: input.actor.role, capabilities: caps }) && !caps.includes("confirm_payout")) {
    return fail("Only an authorised user can verify a payout.", 403);
  }
  if (!canApproveCommission({ actorId: input.actor.id, beneficiaryId, role: input.actor.role, capabilities: [...caps, "approve_commission"] })) {
    return fail("You cannot verify a payout to yourself.", 403);
  }
  if (line.approval_status !== "approved") return fail("Approve the allocation before verifying a payout.", 409);
  const paid = cents(line.payout_cents) + input.payoutCents;
  const approved = cents(line.amount_cents);
  if (paid > approved) return fail("Payout exceeds the approved allocation.", 400);
  const progress = payoutProgress({ approvedCents: approved, paidCents: paid });
  const payoutStatus = progress === "paid" ? "paid" : "partially_paid";
  const nowIso = new Date().toISOString();
  const { data: updatedLine, error } = await supabase
    .from("real_estate_commission_allocations")
    .update({
      payout_cents: paid,
      payout_status: payoutStatus,
      payment_reference: input.reference ?? line.payment_reference,
      verified_paid_at: nowIso,
    })
    .eq("id", input.allocationId)
    .eq("client_id", input.clientId)
    .eq("payout_cents", cents(line.payout_cents))
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!updatedLine) return fail("This payout changed while you were working. Refresh and try again.", 409);
  if (input.payoutId) {
    await supabase
      .from("real_estate_commission_payouts")
      .update({ status: "verified", verified_by: input.actor.id, verified_at: nowIso })
      .eq("id", input.payoutId)
      .eq("client_id", input.clientId)
      .eq("allocation_id", input.allocationId)
      .eq("status", "reported");
  } else {
    const history = await supabase.from("real_estate_commission_payouts").insert({
      client_id: input.clientId,
      commission_id: line.commission_id,
      allocation_id: input.allocationId,
      amount_cents: input.payoutCents,
      status: "verified",
      reference: input.reference ?? null,
      reported_by: input.actor.id,
      verified_by: input.actor.id,
      verified_at: nowIso,
    });
    if (history.error && !missing(history.error)) console.error("[commission-payout]", history.error.message);
  }
  await supabase.from("real_estate_commission_events").insert({
    client_id: input.clientId,
    commission_id: line.commission_id,
    allocation_id: input.allocationId,
    event_type: "payout_verified",
    amount_cents: input.payoutCents,
    actor_id: input.actor.id,
    note: input.reference ?? null,
  });
  const { data: siblings } = await supabase
    .from("real_estate_commission_allocations")
    .select("amount_cents, payout_cents, approval_status")
    .eq("commission_id", line.commission_id as string)
    .eq("client_id", input.clientId);
  const current = siblings?.filter((row) => row.approval_status === "approved") ?? [];
  const complete = current.length > 0 && current.every((row) => cents(row.payout_cents) >= cents(row.amount_cents));
  const commission = await loadCommission(input.clientId, line.commission_id as string);
  if (commission && commission.status !== "disputed" && commission.status !== "cancelled") {
    const next = complete ? "paid" : "partially_paid";
    await supabase
      .from("real_estate_commissions")
      .update({ status: next, updated_at: nowIso })
      .eq("id", line.commission_id as string)
      .eq("client_id", input.clientId);
    if (commission.status !== next) {
      await supabase.from("real_estate_commission_events").insert({
        client_id: input.clientId,
        commission_id: line.commission_id,
        event_type: "record_payout",
        from_value: commission.status,
        to_value: next,
        actor_id: input.actor.id,
      });
    }
  }
  return { ok: true as const, payoutStatus };
}

export async function openCommissionDispute(input: {
  clientId: string;
  actor: AgencyActor;
  commissionId: string;
  allocationId?: string | null;
  reason: string;
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const commission = await loadCommission(input.clientId, input.commissionId);
  if (!commission) return fail("Commission not found.", 404);
  if (commission.status === "cancelled") return fail("This commission is cancelled.", 409);
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  const beneficiaries = await commissionBeneficiaries(input.clientId, input.commissionId);
  if (!isFinance(input.actor, caps) && !beneficiaries.has(input.actor.id)) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  if (input.allocationId) {
    const { data: line } = await supabase
      .from("real_estate_commission_allocations")
      .select("id")
      .eq("id", input.allocationId)
      .eq("commission_id", input.commissionId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!line) return fail("Allocation not found on this commission.", 404);
  }
  const { data, error } = await supabase
    .from("real_estate_commission_disputes")
    .insert({
      client_id: input.clientId,
      commission_id: input.commissionId,
      allocation_id: input.allocationId ?? null,
      opened_by: input.actor.id,
      reason: input.reason.trim(),
      status: "open",
    })
    .select("*")
    .single();
  if (error || !data) return migrationFail(error, "Could not open the dispute.");
  if (commission.status !== "disputed") {
    await supabase
      .from("real_estate_commissions")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", input.commissionId)
      .eq("client_id", input.clientId);
  }
  await supabase.from("real_estate_commission_events").insert({
    client_id: input.clientId,
    commission_id: input.commissionId,
    allocation_id: input.allocationId ?? null,
    event_type: "dispute",
    from_value: commission.status as string,
    to_value: "disputed",
    note: input.reason,
    actor_id: input.actor.id,
  });
  return { ok: true as const, dispute: data };
}

/**
 * Finance review of a dispute. An adjustment supersedes the disputed allocation
 * with a new pending line; the original row and its payouts are kept.
 */
export async function reviewCommissionDispute(input: {
  clientId: string;
  actor: AgencyActor;
  disputeId: string;
  decision: "reviewing" | "upheld" | "adjusted" | "resolved";
  note?: string | null;
  adjustedAmountCents?: number | null;
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  if (!isAgencyManager(input.actor.role) && !caps.includes("approve_commission")) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data: dispute } = await supabase
    .from("real_estate_commission_disputes")
    .select("*")
    .eq("id", input.disputeId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!dispute) return fail("Dispute not found.", 404);
  if (dispute.status === "upheld" || dispute.status === "adjusted" || dispute.status === "resolved") {
    return fail("This dispute is already decided.", 409);
  }
  if (dispute.opened_by === input.actor.id && !isAgencyManager(input.actor.role)) {
    return fail("Someone other than the person who raised the dispute must decide it.", 403);
  }
  if (input.decision !== "reviewing" && !input.note?.trim()) return fail("Record the reason for the decision.", 400);

  let adjustmentId: string | null = null;
  if (input.decision === "adjusted") {
    if (!dispute.allocation_id) return fail("Pick the allocation to adjust.", 400);
    if (input.adjustedAmountCents == null || !Number.isInteger(input.adjustedAmountCents) || input.adjustedAmountCents < 0) {
      return fail("Enter the corrected amount in whole cents.", 400);
    }
    const { data: line } = await supabase
      .from("real_estate_commission_allocations")
      .select("*")
      .eq("id", dispute.allocation_id as string)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!line) return fail("Allocation not found.", 404);
    if (line.beneficiary_id === input.actor.id) return fail("You cannot adjust an allocation that pays you.", 403);
    if (cents(line.payout_cents) > input.adjustedAmountCents) {
      return fail("Verified payouts already exceed that amount. Record a recovery outside this adjustment.", 409);
    }
    const commission = await loadCommission(input.clientId, dispute.commission_id as string);
    const { data: others } = await supabase
      .from("real_estate_commission_allocations")
      .select("id, amount_cents, approval_status")
      .eq("client_id", input.clientId)
      .eq("commission_id", dispute.commission_id as string);
    const otherTotal = (others ?? [])
      .filter((row) => row.id !== line.id && row.approval_status !== "superseded" && row.approval_status !== "rejected")
      .reduce((sum, row) => sum + cents(row.amount_cents), 0);
    if (commission && otherTotal + input.adjustedAmountCents > cents(commission.gross_cents)) {
      return fail("The adjusted allocations would exceed the commission.", 400);
    }
    const inserted = await supabase
      .from("real_estate_commission_allocations")
      .insert({
        client_id: input.clientId,
        commission_id: line.commission_id,
        beneficiary_id: line.beneficiary_id,
        participant_role: line.participant_role,
        mode: "fixed",
        fixed_cents: input.adjustedAmountCents,
        amount_cents: input.adjustedAmountCents,
        absorbs_remainder: false,
        approval_status: "pending",
        payout_cents: cents(line.payout_cents),
        adjusts_allocation_id: line.id,
        notes: `Adjusted after dispute: ${input.note?.trim() ?? ""}`,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) return migrationFail(inserted.error, "Could not record the adjustment.");
    adjustmentId = inserted.data.id as string;
    await supabase
      .from("real_estate_commission_allocations")
      .update({ approval_status: "superseded" })
      .eq("id", line.id as string)
      .eq("client_id", input.clientId);
    await supabase.from("real_estate_commission_events").insert({
      client_id: input.clientId,
      commission_id: line.commission_id,
      allocation_id: adjustmentId,
      event_type: "allocation_adjusted",
      from_value: String(line.amount_cents),
      to_value: String(input.adjustedAmountCents),
      amount_cents: input.adjustedAmountCents,
      actor_id: input.actor.id,
      note: input.note ?? null,
    });
  }

  const nowIso = new Date().toISOString();
  const update = await supabase
    .from("real_estate_commission_disputes")
    .update({
      status: input.decision,
      decision_note: input.note ?? null,
      decided_by: input.decision === "reviewing" ? null : input.actor.id,
      decided_at: input.decision === "reviewing" ? null : nowIso,
      adjustment_allocation_id: adjustmentId,
      updated_at: nowIso,
    })
    .eq("id", input.disputeId)
    .eq("client_id", input.clientId)
    .select("*")
    .single();
  if (update.error) return migrationFail(update.error, "Could not save the decision.");

  if (input.decision !== "reviewing") {
    const { count } = await supabase
      .from("real_estate_commission_disputes")
      .select("id", { count: "exact", head: true })
      .eq("client_id", input.clientId)
      .eq("commission_id", dispute.commission_id as string)
      .in("status", ["open", "reviewing"]);
    if (!count) {
      const { data: lastDispute } = await supabase
        .from("real_estate_commission_events")
        .select("from_value")
        .eq("client_id", input.clientId)
        .eq("commission_id", dispute.commission_id as string)
        .eq("event_type", "dispute")
        .neq("from_value", "disputed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const restore = (lastDispute?.from_value as string | null) ?? "projected";
      await supabase
        .from("real_estate_commissions")
        .update({ status: restore, updated_at: nowIso })
        .eq("id", dispute.commission_id as string)
        .eq("client_id", input.clientId)
        .eq("status", "disputed");
      await supabase.from("real_estate_commission_events").insert({
        client_id: input.clientId,
        commission_id: dispute.commission_id,
        event_type: "dispute_closed",
        from_value: "disputed",
        to_value: restore,
        actor_id: input.actor.id,
        note: input.note ?? null,
      });
    }
  }
  return { ok: true as const, dispute: update.data, adjustmentAllocationId: adjustmentId };
}

type CommissionRow = Record<string, unknown>;

function ledgerRow(row: CommissionRow) {
  const status = String(row.status ?? "projected");
  const gross = cents(row.gross_cents);
  const has = (key: string) => row[key] !== undefined && row[key] !== null;
  const reached = (statuses: string[]) => (statuses.includes(status) ? gross : 0);
  return {
    status,
    grossCents: gross,
    provenance: (row.provenance as string | null) ?? null,
    earnedCents: has("earned_cents")
      ? cents(row.earned_cents)
      : reached(["earned", "invoiced", "reported_received", "verified_received", "allocation_approved", "partially_paid", "paid"]),
    invoicedCents: has("invoiced_cents")
      ? cents(row.invoiced_cents)
      : reached(["invoiced", "reported_received", "verified_received", "allocation_approved", "partially_paid", "paid"]),
    reportedReceivedCents: has("reported_received_cents")
      ? cents(row.reported_received_cents)
      : reached(["reported_received", "verified_received", "allocation_approved", "partially_paid", "paid"]),
    verifiedReceivedCents: has("verified_received_cents")
      ? cents(row.verified_received_cents)
      : reached(["verified_received", "allocation_approved", "partially_paid", "paid"]),
  };
}

export async function listCommissions(
  clientId: string,
  actor: AgencyActor,
  options: { page?: number; pageSize?: number } = {}
) {
  if (!allowed(actor, clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(clientId, actor.id, actor.role);
  const finance = isFinance(actor, caps);
  const supabase = createAdminClient();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));

  const allLines = await readAllPages((from, to) => {
    let query = supabase.from("real_estate_commission_allocations").select("*").eq("client_id", clientId);
    if (!finance) query = query.eq("beneficiary_id", actor.id);
    return query.order("id").range(from, to);
  });
  if (allLines.error) return migrationFail(allLines.error, "Could not load allocations.");

  let commissionIds: string[] | null = null;
  if (!finance) commissionIds = [...new Set(allLines.rows.map((line) => line.commission_id as string))];

  const allCommissions = await readAllPages((from, to) => {
    let query = supabase.from("real_estate_commissions").select("*").eq("client_id", clientId);
    if (commissionIds) query = query.in("id", commissionIds.length ? commissionIds : ["00000000-0000-0000-0000-000000000000"]);
    return query.order("created_at", { ascending: false }).order("id").range(from, to);
  });
  if (allCommissions.error) return migrationFail(allCommissions.error, "Could not load commissions.");

  const statusById = new Map(allCommissions.rows.map((row) => [row.id as string, String(row.status)]));
  const currentLines = allLines.rows.filter((line) => line.approval_status !== "superseded");
  const allocationLedger = currentLines
    .filter((line) => statusById.get(line.commission_id as string) !== "cancelled")
    .map((line) => ({
      amountCents: cents(line.amount_cents),
      approvalStatus: String(line.approval_status),
      payoutCents: cents(line.payout_cents),
      reportedPayoutCents: cents(line.reported_payout_cents),
    }));

  const totals = finance
    ? commissionTotals(allCommissions.rows.map(ledgerRow), allocationLedger)
    : {
        ...commissionTotals([], allocationLedger),
        projectedCents: allocationLedger.reduce((sum, line) => sum + line.amountCents, 0),
      };

  const pageRows = allCommissions.rows.slice((page - 1) * pageSize, page * pageSize);
  const txnIds = [...new Set(pageRows.map((row) => row.transaction_id as string))];
  const { data: txns } = txnIds.length
    ? await supabase
        .from("real_estate_transactions")
        .select("id, listing_id, transaction_type, status")
        .eq("client_id", clientId)
        .in("id", txnIds)
    : { data: [] as Array<Record<string, unknown>> };
  const listingIds = [...new Set((txns ?? []).map((row) => row.listing_id as string).filter(Boolean))];
  const { data: listings } = listingIds.length
    ? await supabase.from("listings").select("id, address, suburb").eq("client_id", clientId).in("id", listingIds)
    : { data: [] as Array<Record<string, unknown>> };
  const listingLabel = new Map(
    (listings ?? []).map((row) => [row.id as string, [row.address, row.suburb].filter(Boolean).join(", ") || "Property"])
  );
  const txnLabel = new Map(
    (txns ?? []).map((row) => [row.id as string, listingLabel.get(row.listing_id as string) ?? "Property"])
  );
  const pageIds = new Set(pageRows.map((row) => row.id as string));
  const beneficiaryIds = [
    ...new Set(currentLines.filter((line) => pageIds.has(line.commission_id as string)).map((line) => line.beneficiary_id as string).filter(Boolean)),
  ];
  const { data: people } = beneficiaryIds.length
    ? await supabase.from("users").select("id, name").eq("client_id", clientId).in("id", beneficiaryIds)
    : { data: [] as Array<Record<string, unknown>> };
  const nameById = new Map((people ?? []).map((row) => [row.id as string, (row.name as string | null) ?? "Team member"]));

  let disputesQuery = supabase
    .from("real_estate_commission_disputes")
    .select("*")
    .eq("client_id", clientId)
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (!finance) disputesQuery = disputesQuery.eq("opened_by", actor.id);
  const { data: disputes } = await disputesQuery;

  return {
    ok: true as const,
    actorId: actor.id,
    finance,
    canVerifyReceipt: canVerifyCommissionReceipt({ role: actor.role, capabilities: caps }),
    scope: finance ? ("organisation" as const) : ("own_allocations" as const),
    page,
    pageSize,
    total: allCommissions.rows.length,
    incomplete: allCommissions.incomplete || allLines.incomplete,
    commissions: pageRows.map((row) => ({
      ...ledgerRow(row),
      id: row.id as string,
      transaction_id: row.transaction_id as string,
      transactionLabel: txnLabel.get(row.transaction_id as string) ?? "Property",
      currency: (row.currency as string | null) ?? "USD",
      created_at: row.created_at as string,
      legacy_fields: finance ? row.legacy_fields ?? null : null,
    })),
    allocations: currentLines
      .filter((line) => pageIds.has(line.commission_id as string))
      .map((line) => ({ ...line, beneficiary_name: nameById.get(line.beneficiary_id as string) ?? null })),
    disputes: disputes ?? [],
    totals: {
      ...totals,
      definition:
        "Each stage is cumulative and is never cleared by a later status. Projected is not cash. Earned records the agency's earning condition. Reported is not verified. Verified includes only receipts confirmed by an authorised user, including receipts on commissions later cancelled. Approved is an internal allocation decision. Outstanding payable is approved minus verified payouts. Legacy unverified rows are shown apart.",
    },
  };
}

export async function cancelCommissionForFailedTransaction(clientId: string, transactionId: string, actorId: string | null) {
  const supabase = createAdminClient();
  const failure = commissionAfterTransactionFailure();
  const { data } = await supabase
    .from("real_estate_commissions")
    .select("*")
    .eq("client_id", clientId)
    .eq("transaction_id", transactionId)
    .neq("status", "cancelled");
  for (const row of data ?? []) {
    if (row.status === "verified_received" || row.status === "paid" || row.status === "partially_paid") continue;
    if (cents(row.verified_received_cents) > 0) continue;
    await supabase
      .from("real_estate_commissions")
      .update({ status: failure.status, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("client_id", clientId)
      .eq("status", row.status);
    await supabase.from("real_estate_commission_events").insert({
      client_id: clientId,
      commission_id: row.id,
      event_type: "cancelled_with_transaction",
      from_value: row.status,
      to_value: failure.status,
      actor_id: actorId,
      note: "The transaction failed. This commission was not verified as received.",
    });
  }
}

// ---------------------------------------------------------------------------
// Deal participants, transaction access and operations
// ---------------------------------------------------------------------------

type TransactionAccess = {
  txn: Record<string, unknown>;
  listingAgentId: string | null;
  roles: ParticipantRole[];
  isManager: boolean;
  isParticipant: boolean;
  caps: AgencyCapability[];
};

async function transactionAccess(
  clientId: string,
  actor: AgencyActor,
  transactionId: string
): Promise<{ ok: true; access: TransactionAccess } | Fail> {
  if (!allowed(actor, clientId)) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data: txn } = await supabase
    .from("real_estate_transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!txn) return fail("Transaction not found.", 404);
  const { data: listing } = await supabase
    .from("listings")
    .select("agent_id")
    .eq("id", txn.listing_id as string)
    .eq("client_id", clientId)
    .maybeSingle();
  const { data: participantRows } = await supabase
    .from("real_estate_deal_participants")
    .select("participant_role, access_status, ended_at")
    .eq("client_id", clientId)
    .eq("transaction_id", transactionId)
    .eq("user_id", actor.id);
  const roles = new Set<ParticipantRole>(
    (participantRows ?? [])
      .filter((row) => row.access_status === "active" && !row.ended_at)
      .map((row) => row.participant_role as ParticipantRole)
  );
  if (txn.buyer_agent_id === actor.id) roles.add("buyer_agent");
  if (txn.listing_agent_id === actor.id || listing?.agent_id === actor.id) roles.add("listing_agent");
  const caps = await staffCapabilities(clientId, actor.id, actor.role);
  const isManager = isAgencyManager(actor.role);
  if (!isManager && roles.size === 0) return fail("Forbidden.", 403);
  return {
    ok: true,
    access: {
      txn,
      listingAgentId: (listing?.agent_id as string | null) ?? null,
      roles: [...roles],
      isManager,
      isParticipant: roles.size > 0,
      caps,
    },
  };
}

async function insertParticipant(input: {
  clientId: string;
  addedBy: string;
  transactionId?: string | null;
  listingId?: string | null;
  userId: string;
  role: ParticipantRole;
  responsibilities?: string | null;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_deal_participants")
    .insert({
      client_id: input.clientId,
      transaction_id: input.transactionId ?? null,
      listing_id: input.listingId ?? null,
      user_id: input.userId,
      participant_role: input.role,
      responsibilities: input.responsibilities ?? null,
      added_by: input.addedBy,
    })
    .select("*")
    .single();
  if (error?.code === "23505") return { ok: true as const, participant: null, alreadyPresent: true };
  if (error || !data) return migrationFail(error, "Could not add the participant.");
  return { ok: true as const, participant: data, alreadyPresent: false };
}

export async function addDealParticipant(input: {
  clientId: string;
  actor: AgencyActor;
  transactionId?: string | null;
  listingId?: string | null;
  userId: string;
  role: ParticipantRole;
  responsibilities?: string | null;
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  if (!input.transactionId && !input.listingId) return fail("Choose a transaction or listing.", 400);
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  if (!isAgencyManager(input.actor.role) && !caps.includes("manage_milestones")) return fail("Forbidden.", 403);
  const member = await orgUser(input.clientId, input.userId);
  if (!member || !member.is_active) return fail("That person is not an active member of this organisation.", 400);
  const supabase = createAdminClient();
  if (input.transactionId) {
    const { data } = await supabase
      .from("real_estate_transactions")
      .select("id")
      .eq("id", input.transactionId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!data) return fail("Transaction not found.", 404);
  }
  if (input.listingId) {
    const { data } = await supabase.from("listings").select("id").eq("id", input.listingId).eq("client_id", input.clientId).maybeSingle();
    if (!data) return fail("Listing not found.", 404);
  }
  return insertParticipant({ ...input, addedBy: input.actor.id });
}

export async function endDealParticipant(input: { clientId: string; actor: AgencyActor; participantId: string }) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  if (!isAgencyManager(input.actor.role) && !caps.includes("manage_milestones")) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_deal_participants")
    .update({ access_status: "ended", ended_at: new Date().toISOString() })
    .eq("id", input.participantId)
    .eq("client_id", input.clientId)
    .is("ended_at", null)
    .select("id")
    .maybeSingle();
  if (error) return migrationFail(error, "Could not end the participation.");
  if (!data) return fail("Participant not found or already ended.", 404);
  return { ok: true as const };
}

export async function dealVisibility(clientId: string, actor: AgencyActor, transactionId: string) {
  const access = await transactionAccess(clientId, actor, transactionId);
  if (!access.ok) return visibleDealSlice({ roles: [], isManager: false, capabilities: [] });
  return visibleDealSlice({ roles: access.access.roles, isManager: access.access.isManager, capabilities: access.access.caps });
}

/** Transaction operations data, shaped by the actor's role on the deal. */
export async function transactionOperations(clientId: string, actor: AgencyActor, transactionId: string) {
  const checked = await transactionAccess(clientId, actor, transactionId);
  if (!checked.ok) return checked;
  const { access } = checked;
  const slice = visibleDealSlice({ roles: access.roles, isManager: access.isManager, capabilities: access.caps });
  const supabase = createAdminClient();
  const canManageMilestones =
    access.isManager || access.caps.includes("manage_milestones") || access.roles.includes("transaction_coordinator");
  const canReviewDocuments = access.isManager || access.caps.includes("review_documents");
  const canAddParticipants = access.isManager || access.caps.includes("manage_milestones");

  const [milestones, participants, documents, activities] = await Promise.all([
    supabase
      .from("real_estate_transaction_milestones")
      .select("*")
      .eq("client_id", clientId)
      .eq("transaction_id", transactionId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("real_estate_deal_participants")
      .select("id, user_id, participant_role, responsibilities, started_at, ended_at, access_status, external_name")
      .eq("client_id", clientId)
      .eq("transaction_id", transactionId)
      .order("started_at", { ascending: true }),
    supabase
      .from("real_estate_transaction_documents")
      .select("*")
      .eq("client_id", clientId)
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_subjects")
      .select("id, title, due_at, completed_at, assigned_to_id, priority")
      .eq("client_id", clientId)
      .eq("subject_type", "transaction")
      .eq("subject_id", transactionId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(50),
  ]);

  const visibleDocuments = (documents.data ?? []).filter((doc) =>
    canSeeTransactionDocument({
      visibility: String(doc.visibility ?? "participants"),
      isManager: access.isManager,
      capabilities: access.caps,
      isParticipant: access.isParticipant && slice.documents,
      isUploader: doc.uploaded_by === actor.id,
    })
  );

  let commission: { commissions: Record<string, unknown>[]; allocations: Record<string, unknown>[] } | null = null;
  const { data: commissionRows } = await supabase
    .from("real_estate_commissions")
    .select("*")
    .eq("client_id", clientId)
    .eq("transaction_id", transactionId);
  const commissionIds = (commissionRows ?? []).map((row) => row.id as string);
  const { data: allocationRows } = commissionIds.length
    ? await supabase.from("real_estate_commission_allocations").select("*").eq("client_id", clientId).in("commission_id", commissionIds)
    : { data: [] as Array<Record<string, unknown>> };
  if (slice.commission || access.isManager) {
    commission = { commissions: (commissionRows ?? []).map((row) => ({ ...row, ...ledgerRow(row) })), allocations: allocationRows ?? [] };
  } else {
    const own = (allocationRows ?? []).filter((line) => line.beneficiary_id === actor.id);
    if (own.length) {
      const ownIds = new Set(own.map((line) => line.commission_id as string));
      commission = {
        commissions: (commissionRows ?? [])
          .filter((row) => ownIds.has(row.id as string))
          .map((row) => ({ id: row.id, status: row.status, currency: row.currency })),
        allocations: own,
      };
    }
  }

  const userIds = new Set<string>();
  for (const row of milestones.data ?? []) if (row.assigned_to_id) userIds.add(row.assigned_to_id as string);
  for (const row of participants.data ?? []) if (row.user_id) userIds.add(row.user_id as string);
  for (const row of activities.data ?? []) if (row.assigned_to_id) userIds.add(row.assigned_to_id as string);
  for (const row of visibleDocuments) {
    if (row.uploaded_by) userIds.add(row.uploaded_by as string);
    if (row.reviewed_by) userIds.add(row.reviewed_by as string);
  }
  for (const row of commission?.allocations ?? []) if (row.beneficiary_id) userIds.add(row.beneficiary_id as string);
  const { data: people } = userIds.size
    ? await supabase.from("users").select("id, name").eq("client_id", clientId).in("id", [...userIds])
    : { data: [] as Array<Record<string, unknown>> };
  const nameById = Object.fromEntries((people ?? []).map((row) => [row.id as string, (row.name as string | null) ?? "Team member"]));

  const team = canManageMilestones || canAddParticipants || canReviewDocuments ? await staffDirectory(clientId, actor) : null;

  return {
    ok: true as const,
    roles: access.roles,
    slice,
    permissions: {
      manageMilestones: canManageMilestones,
      reviewDocuments: canReviewDocuments,
      addParticipants: canAddParticipants,
      uploadDocuments: true,
      viewCommission: Boolean(commission),
      manageCommission: access.isManager || access.caps.includes("approve_commission"),
    },
    milestones: milestones.data ?? [],
    participants: participants.data ?? [],
    documents: visibleDocuments.map(({ storage_key, ...doc }) => ({ ...doc, has_file: Boolean(storage_key) })),
    documentsHidden: (documents.data ?? []).length - visibleDocuments.length,
    activities: activities.data ?? [],
    commission,
    names: nameById,
    team: team && team.ok ? team.staff : [],
  };
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export async function createCollaborationRequest(input: {
  clientId: string;
  actor: AgencyActor;
  kind: "listing_assistance" | "buyer_introduction" | "transaction_participation" | "manager_intervention";
  listingId?: string | null;
  searchId?: string | null;
  transactionId?: string | null;
  owningUserId?: string | null;
  note?: string | null;
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  let owner = input.owningUserId ?? null;
  if (input.listingId) {
    const { data } = await supabase.from("listings").select("id, agent_id").eq("id", input.listingId).eq("client_id", input.clientId).maybeSingle();
    if (!data) return fail("Listing not found.", 404);
    owner = owner ?? ((data.agent_id as string | null) ?? null);
  }
  if (input.transactionId) {
    const { data } = await supabase
      .from("real_estate_transactions")
      .select("id, listing_agent_id")
      .eq("id", input.transactionId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!data) return fail("Transaction not found.", 404);
    owner = owner ?? ((data.listing_agent_id as string | null) ?? null);
  }
  if (input.searchId) {
    const { data } = await supabase
      .from("real_estate_buyer_searches")
      .select("id, assigned_agent_id")
      .eq("id", input.searchId)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (!data) return fail("Search not found.", 404);
    owner = owner ?? ((data.assigned_agent_id as string | null) ?? null);
  }
  if (owner && !(await orgUser(input.clientId, owner))) return fail("The owner is not in this organisation.", 400);
  if (owner === input.actor.id) return fail("You already own this record.", 400);
  const { data: open } = await supabase
    .from("real_estate_collaboration_requests")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("requesting_user_id", input.actor.id)
    .eq("kind", input.kind)
    .eq("status", "requested")
    .match({
      ...(input.listingId ? { listing_id: input.listingId } : {}),
      ...(input.transactionId ? { transaction_id: input.transactionId } : {}),
      ...(input.searchId ? { search_id: input.searchId } : {}),
    })
    .limit(1);
  if ((open ?? []).length) return { ok: true as const, request: open?.[0], alreadyRequested: true };
  const { data, error } = await supabase
    .from("real_estate_collaboration_requests")
    .insert({
      client_id: input.clientId,
      kind: input.kind,
      listing_id: input.listingId ?? null,
      search_id: input.searchId ?? null,
      transaction_id: input.transactionId ?? null,
      requesting_user_id: input.actor.id,
      owning_user_id: owner,
      note: input.note ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return migrationFail(error, "Could not send the request.");
  return { ok: true as const, request: data, alreadyRequested: false };
}

export async function reviewCollaborationRequest(input: {
  clientId: string;
  actor: AgencyActor;
  requestId: string;
  decision: "approved" | "declined";
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("real_estate_collaboration_requests")
    .select("*")
    .eq("id", input.requestId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!row) return fail("Request not found.", 404);
  const owner = row.owning_user_id as string | null;
  if (!isAgencyManager(input.actor.role) && owner !== input.actor.id) return fail("Forbidden.", 403);
  if (row.status !== "requested") {
    return row.status === input.decision ? { ok: true as const, request: row } : fail("This request is already decided.", 409);
  }
  const { data, error } = await supabase
    .from("real_estate_collaboration_requests")
    .update({ status: input.decision, decided_by: input.actor.id, decided_at: new Date().toISOString() })
    .eq("id", input.requestId)
    .eq("client_id", input.clientId)
    .eq("status", "requested")
    .select("*")
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail("This request was decided by someone else.", 409);
  if (input.decision === "approved" && row.requesting_user_id) {
    if (row.kind === "transaction_participation" && row.transaction_id) {
      await insertParticipant({
        clientId: input.clientId,
        addedBy: input.actor.id,
        transactionId: row.transaction_id as string,
        userId: row.requesting_user_id as string,
        role: "additional",
        responsibilities: "Approved collaboration. WhatsApp sessions are not shared.",
      });
    }
    if (row.kind === "listing_assistance" && row.listing_id) {
      await insertParticipant({
        clientId: input.clientId,
        addedBy: input.actor.id,
        listingId: row.listing_id as string,
        userId: row.requesting_user_id as string,
        role: "additional",
        responsibilities: "Approved listing assistance. WhatsApp sessions are not shared.",
      });
    }
  }
  return { ok: true as const, request: data };
}

// ---------------------------------------------------------------------------
// Handover
// ---------------------------------------------------------------------------

type HandoverSource = {
  type: HandoverAssignment["recordType"];
  table: string;
  column: string;
  select: string;
  label: string;
  scope: (query: any) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  describe: (row: Record<string, unknown>) => string;
};

const ACTIVE_TXN = ["draft", "pending_compliance", "in_progress"];

const HANDOVER_SOURCES: HandoverSource[] = [
  {
    type: "acquisition",
    table: "real_estate_acquisition_opportunities",
    column: "assigned_agent_id",
    select: "id, reference_number, owner_name, suburb",
    label: "Acquisitions",
    scope: (q) => q.in("status", ["active", "on_hold", "nurturing"]),
    describe: (row) => [row.reference_number, row.owner_name, row.suburb].filter(Boolean).join(" · ") || "Acquisition",
  },
  {
    type: "inspection",
    table: "real_estate_inspections",
    column: "agent_id",
    select: "id, address, suburb, scheduled_at",
    label: "Inspections",
    scope: (q) => q.in("status", ["draft", "scheduled", "confirmed", "rescheduled", "in_progress"]),
    describe: (row) => [row.address, row.suburb].filter(Boolean).join(", ") || "Inspection",
  },
  {
    type: "listing",
    table: "listings",
    column: "agent_id",
    select: "id, address, suburb, status",
    label: "Listings",
    scope: (q) => q.not("status", "in", "(sold,let,rented)"),
    describe: (row) => [row.address, row.suburb].filter(Boolean).join(", ") || "Listing",
  },
  {
    type: "buyer_search",
    table: "real_estate_buyer_searches",
    column: "assigned_agent_id",
    select: "id, intent, locations",
    label: "Buyer and tenant searches",
    scope: (q) => q.in("status", ["active", "paused", "needs_review"]),
    describe: (row) =>
      `${row.intent === "rental" ? "Rental" : "Purchase"} search${Array.isArray(row.locations) && row.locations.length ? ` · ${(row.locations as string[]).join(", ")}` : ""}`,
  },
  {
    type: "viewing",
    table: "viewings",
    column: "agent_id",
    select: "id, scheduled_at",
    label: "Upcoming viewings",
    scope: (q) => q.eq("status", "scheduled").gte("scheduled_at", new Date().toISOString()),
    describe: (row) => `Viewing ${String(row.scheduled_at ?? "").slice(0, 16).replace("T", " ")}`,
  },
  {
    type: "transaction_buyer",
    table: "real_estate_transactions",
    column: "buyer_agent_id",
    select: "id, status",
    label: "Transactions (buyer side)",
    scope: (q) => q.in("status", ACTIVE_TXN),
    describe: (row) => `Transaction · ${String(row.status ?? "").replaceAll("_", " ")}`,
  },
  {
    type: "transaction_listing",
    table: "real_estate_transactions",
    column: "listing_agent_id",
    select: "id, status",
    label: "Transactions (listing side)",
    scope: (q) => q.in("status", ACTIVE_TXN),
    describe: (row) => `Transaction · ${String(row.status ?? "").replaceAll("_", " ")}`,
  },
  {
    type: "milestone",
    table: "real_estate_transaction_milestones",
    column: "assigned_to_id",
    select: "id, milestone_key, transaction_id",
    label: "Assigned milestones",
    scope: (q) => q.in("status", ["pending", "in_progress", "blocked"]),
    describe: (row) => String(row.milestone_key ?? "Milestone").replaceAll("_", " "),
  },
  {
    type: "activity",
    table: "activity_subjects",
    column: "assigned_to_id",
    select: "id, title, due_at",
    label: "Open activities",
    scope: (q) => q.is("completed_at", null),
    describe: (row) => String(row.title ?? "Activity"),
  },
  {
    type: "collaboration",
    table: "real_estate_collaboration_requests",
    column: "owning_user_id",
    select: "id, kind",
    label: "Collaboration requests awaiting a decision",
    scope: (q) => q.eq("status", "requested"),
    describe: (row) => String(row.kind ?? "Request").replaceAll("_", " "),
  },
];

const SOURCE_BY_TYPE = new Map(HANDOVER_SOURCES.map((source) => [source.type, source]));

function fingerprintKeys(keys: readonly string[]): string {
  return createHash("sha256").update([...keys].sort().join("\n")).digest("hex");
}

async function discoverHandover(clientId: string, fromUserId: string) {
  const supabase = createAdminClient();
  const assignments: Array<HandoverAssignment & { label: string }> = [];
  const totals: Array<{ type: string; label: string; count: number; incomplete: boolean; unavailable: boolean }> = [];
  for (const source of HANDOVER_SOURCES) {
    const result = await readAllPages(
      (from, to) =>
        source
          .scope(supabase.from(source.table).select(source.select).eq("client_id", clientId).eq(source.column, fromUserId))
          .order("id")
          .range(from, to),
      { pageSize: 500, ceiling: 20000 }
    );
    if (result.error) {
      totals.push({ type: source.type, label: source.label, count: 0, incomplete: true, unavailable: missing(result.error) });
      continue;
    }
    for (const row of result.rows) {
      assignments.push({
        recordType: source.type,
        recordId: row.id as string,
        currentAssigneeId: fromUserId,
        originalContributorId: fromUserId,
        label: source.describe(row),
      });
    }
    totals.push({ type: source.type, label: source.label, count: result.rows.length, incomplete: result.incomplete, unavailable: false });
  }
  const keys = assignments.map((row) => handoverRecordKey(row.recordType, row.recordId));
  return { assignments, totals, keys, fingerprint: fingerprintKeys(keys) };
}

export async function previewHandover(clientId: string, actor: AgencyActor, fromUserId: string) {
  if (!allowed(actor, clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(clientId, actor.id, actor.role);
  if (!isAgencyManager(actor.role) && !caps.includes("reassign_work")) return fail("Forbidden.", 403);
  const fromUser = await orgUser(clientId, fromUserId);
  if (!fromUser) return fail("That person is not in this organisation.", 404);
  const found = await discoverHandover(clientId, fromUserId);
  return {
    ok: true as const,
    fromUser: { id: fromUser.id, name: fromUser.name, active: fromUser.is_active },
    assignments: found.assignments,
    totals: found.totals,
    total: found.assignments.length,
    fingerprint: found.fingerprint,
    incomplete: found.totals.some((row) => row.incomplete && !row.unavailable),
    unavailable: found.totals.filter((row) => row.unavailable).map((row) => row.type),
    unchanged: [
      "Sourcing agent on acquisitions",
      "Commission beneficiaries and historical allocations",
      "WhatsApp sessions and conversation ownership",
      "Completed and closed records",
      "The user account itself",
    ],
  };
}

async function applyHandoverItems(input: {
  clientId: string;
  handoverId: string;
  fromUserId: string;
  items: Array<{ recordType: string; recordId: string; toUserId: string }>;
}) {
  const supabase = createAdminClient();
  let applied = 0;
  let skipped = 0;
  let failed = 0;
  const groups = new Map<string, string[]>();
  for (const item of input.items) {
    const key = `${item.recordType}|${item.toUserId}`;
    groups.set(key, [...(groups.get(key) ?? []), item.recordId]);
  }
  for (const [key, ids] of groups) {
    const [recordType, toUserId] = key.split("|");
    const source = SOURCE_BY_TYPE.get(recordType as HandoverAssignment["recordType"]);
    for (const batch of chunk(ids, 200)) {
      if (!source) {
        failed += batch.length;
        continue;
      }
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from(source.table)
        .update({ [source.column]: toUserId })
        .eq("client_id", input.clientId)
        .eq(source.column, input.fromUserId)
        .in("id", batch)
        .select("id");
      if (error) {
        failed += batch.length;
        await supabase
          .from("real_estate_handover_items")
          .update({ status: "failed", error: error.message })
          .eq("client_id", input.clientId)
          .eq("handover_id", input.handoverId)
          .eq("record_type", recordType)
          .in("record_id", batch);
        continue;
      }
      const moved = new Set(((data ?? []) as Array<Record<string, unknown>>).map((row) => row.id as string));
      const appliedIds = batch.filter((id) => moved.has(id));
      const skippedIds = batch.filter((id) => !moved.has(id));
      applied += appliedIds.length;
      skipped += skippedIds.length;
      if (appliedIds.length) {
        const mark = await supabase
          .from("real_estate_handover_items")
          .update({ status: "applied", error: null, applied_at: nowIso })
          .eq("client_id", input.clientId)
          .eq("handover_id", input.handoverId)
          .eq("record_type", recordType)
          .in("record_id", appliedIds);
        if (mark.error && missing(mark.error)) {
          await supabase
            .from("real_estate_handover_items")
            .update({ status: "applied", error: null })
            .eq("client_id", input.clientId)
            .eq("handover_id", input.handoverId)
            .eq("record_type", recordType)
            .in("record_id", appliedIds);
        }
      }
      if (skippedIds.length) {
        const mark = await supabase
          .from("real_estate_handover_items")
          .update({ status: "skipped", error: "No longer assigned to the departing person." })
          .eq("client_id", input.clientId)
          .eq("handover_id", input.handoverId)
          .eq("record_type", recordType)
          .in("record_id", skippedIds);
        if (mark.error) {
          await supabase
            .from("real_estate_handover_items")
            .update({ status: "failed", error: "No longer assigned to the departing person." })
            .eq("client_id", input.clientId)
            .eq("handover_id", input.handoverId)
            .eq("record_type", recordType)
            .in("record_id", skippedIds);
        }
      }
    }
  }
  return { applied, skipped, failed };
}

async function finishHandover(clientId: string, handoverId: string) {
  const supabase = createAdminClient();
  const { data: items } = await supabase
    .from("real_estate_handover_items")
    .select("status")
    .eq("client_id", clientId)
    .eq("handover_id", handoverId);
  const count = (status: string) => (items ?? []).filter((row) => row.status === status).length;
  const summary = {
    total_items: (items ?? []).length,
    applied_items: count("applied"),
    failed_items: count("failed") + count("pending"),
    skipped_items: count("skipped"),
  };
  const status = summary.failed_items ? "partial" : "completed";
  const update = await supabase
    .from("real_estate_handovers")
    .update({ status, completed_at: new Date().toISOString(), ...summary })
    .eq("id", handoverId)
    .eq("client_id", clientId);
  if (update.error && missing(update.error)) {
    await supabase
      .from("real_estate_handovers")
      .update({ status, completed_at: new Date().toISOString() })
      .eq("id", handoverId)
      .eq("client_id", clientId);
  }
  return { status, ...summary };
}

export async function executeHandover(input: {
  clientId: string;
  actor: AgencyActor;
  fromUserId: string;
  defaultReplacementId: string;
  replacementByType?: Partial<Record<string, string>>;
  selectedKeys?: string[] | null;
  expectedFingerprint?: string | null;
  acceptChanges?: boolean;
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  if (!isAgencyManager(input.actor.role) && !caps.includes("reassign_work")) return fail("Forbidden.", 403);
  if (!(await orgUser(input.clientId, input.fromUserId))) return fail("That person is not in this organisation.", 404);
  const replacements = new Set([input.defaultReplacementId, ...Object.values(input.replacementByType ?? {}).filter(Boolean)] as string[]);
  for (const id of replacements) {
    const member = await orgUser(input.clientId, id);
    if (!member || !member.is_active) return fail("Every replacement must be an active member of this organisation.", 400);
  }

  const found = await discoverHandover(input.clientId, input.fromUserId);
  if (input.expectedFingerprint && input.expectedFingerprint !== found.fingerprint && !input.acceptChanges) {
    const drift = handoverDrift(input.selectedKeys ?? [], found.keys);
    return {
      ok: false as const,
      status: 409,
      error: "The assigned work changed since the preview. Preview again and confirm the new list.",
      drift: {
        selectedNoLongerAssigned: input.selectedKeys?.length ? drift.removed.length : null,
        currentTotal: found.keys.length,
      },
      fingerprint: found.fingerprint,
    };
  }

  const selected = input.selectedKeys?.length ? new Set(input.selectedKeys) : null;
  const chosen = selected
    ? found.assignments.filter((row) => selected.has(handoverRecordKey(row.recordType, row.recordId)))
    : found.assignments;
  const missingSelections = selected ? [...selected].filter((key) => !found.keys.includes(key)).length : 0;

  const plan = planHandover({
    fromUserId: input.fromUserId,
    assignments: chosen,
    replacementByType: (input.replacementByType ?? {}) as Partial<Record<HandoverAssignment["recordType"], string>>,
    defaultReplacementId: input.defaultReplacementId,
  });
  if (!plan.ok) return fail(plan.error, 400);
  if (!plan.changes.length) return fail("Nothing selected to hand over.", 400);

  const supabase = createAdminClient();
  const labelByKey = new Map(found.assignments.map((row) => [handoverRecordKey(row.recordType, row.recordId), row.label]));
  const header = {
    client_id: input.clientId,
    from_user_id: input.fromUserId,
    created_by: input.actor.id,
    summary: `${plan.changes.length} current assignments selected of ${found.keys.length} found. Sourcing credit, commission beneficiaries and WhatsApp sessions are not changed.`,
  };
  let created = await supabase
    .from("real_estate_handovers")
    .insert({ ...header, status: "in_progress", to_user_id: input.defaultReplacementId, total_items: plan.changes.length, preview_fingerprint: found.fingerprint })
    .select("id")
    .single();
  if (created.error && (missing(created.error) || /status_check/i.test(created.error.message))) {
    created = await supabase.from("real_estate_handovers").insert({ ...header, status: "draft" }).select("id").single();
  }
  if (created.error || !created.data) return migrationFail(created.error, "Could not start the handover.");
  const handoverId = created.data.id as string;

  for (const batch of chunk(plan.changes, 500)) {
    const rows = batch.map((change) => ({
      client_id: input.clientId,
      handover_id: handoverId,
      record_type: change.recordType,
      record_id: change.recordId,
      from_user_id: input.fromUserId,
      to_user_id: change.nextAssigneeId,
      status: "pending",
      record_label: labelByKey.get(handoverRecordKey(change.recordType, change.recordId)) ?? null,
    }));
    let inserted = await supabase.from("real_estate_handover_items").insert(rows);
    if (inserted.error && missing(inserted.error)) {
      inserted = await supabase
        .from("real_estate_handover_items")
        .insert(rows.map(({ record_label: _label, ...rest }) => rest)); // eslint-disable-line @typescript-eslint/no-unused-vars
    }
    if (inserted.error) return fail(`Could not record the handover items: ${inserted.error.message}`, 500);
  }

  const outcome = await applyHandoverItems({
    clientId: input.clientId,
    handoverId,
    fromUserId: input.fromUserId,
    items: plan.changes.map((change) => ({ recordType: change.recordType, recordId: change.recordId, toUserId: change.nextAssigneeId })),
  });
  const summary = await finishHandover(input.clientId, handoverId);
  return {
    ok: true as const,
    handoverId,
    status: summary.status,
    applied: outcome.applied,
    skipped: outcome.skipped,
    failed: outcome.failed,
    missingSelections,
    notSelected: found.keys.length - plan.changes.length,
    preservedContributorIds: plan.preservedContributorIds,
  };
}

/** Re-applies pending and failed items of an earlier handover. Applied items are not touched. */
export async function retryHandover(input: { clientId: string; actor: AgencyActor; handoverId: string }) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  if (!isAgencyManager(input.actor.role) && !caps.includes("reassign_work")) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data: handover } = await supabase
    .from("real_estate_handovers")
    .select("id, from_user_id, status")
    .eq("id", input.handoverId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!handover) return fail("Handover not found.", 404);
  const { data: items } = await supabase
    .from("real_estate_handover_items")
    .select("record_type, record_id, to_user_id, status")
    .eq("client_id", input.clientId)
    .eq("handover_id", input.handoverId)
    .in("status", ["pending", "failed"]);
  if (!(items ?? []).length) return { ok: true as const, handoverId: input.handoverId, applied: 0, skipped: 0, failed: 0, status: handover.status };
  const outcome = await applyHandoverItems({
    clientId: input.clientId,
    handoverId: input.handoverId,
    fromUserId: handover.from_user_id as string,
    items: (items ?? []).map((row) => ({
      recordType: row.record_type as string,
      recordId: row.record_id as string,
      toUserId: row.to_user_id as string,
    })),
  });
  const summary = await finishHandover(input.clientId, input.handoverId);
  return { ok: true as const, handoverId: input.handoverId, ...outcome, status: summary.status };
}

export async function listHandovers(clientId: string, actor: AgencyActor) {
  if (!allowed(actor, clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(clientId, actor.id, actor.role);
  if (!isAgencyManager(actor.role) && !caps.includes("reassign_work")) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("real_estate_handovers")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return migrationFail(error, "Could not load handovers.");
  return { ok: true as const, handovers: data ?? [] };
}

// ---------------------------------------------------------------------------
// Transaction documents and milestones
// ---------------------------------------------------------------------------

/** Confirms the actor may work on this transaction before any file is stored. */
export async function assertTransactionWorkAccess(clientId: string, actor: AgencyActor, transactionId: string) {
  const checked = await transactionAccess(clientId, actor, transactionId);
  if (!checked.ok) return checked;
  return { ok: true as const };
}

/** Returns the private storage key only when the actor may see the document. */
export async function transactionDocumentForDownload(clientId: string, actor: AgencyActor, documentLinkId: string) {
  if (!allowed(actor, clientId)) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data: doc, error } = await supabase
    .from("real_estate_transaction_documents")
    .select("*")
    .eq("id", documentLinkId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) return migrationFail(error, "Could not load the document.");
  if (!doc) return fail("Document not found.", 404);
  const checked = await transactionAccess(clientId, actor, doc.transaction_id as string);
  if (!checked.ok) return checked;
  const { access } = checked;
  const slice = visibleDealSlice({ roles: access.roles, isManager: access.isManager, capabilities: access.caps });
  const visible = canSeeTransactionDocument({
    visibility: String(doc.visibility ?? "participants"),
    isManager: access.isManager,
    capabilities: access.caps,
    isParticipant: access.isParticipant && slice.documents,
    isUploader: doc.uploaded_by === actor.id,
  });
  if (!visible) return fail("Forbidden.", 403);
  const storageKey = (doc.storage_key as string | null) ?? null;
  if (!storageKey) return fail("This record has no stored file.", 404);
  return { ok: true as const, storageKey, filename: (doc.filename as string | null) ?? "document" };
}

const FINANCE_CATEGORIES = new Set(["payment_proof", "proof_of_payment", "commission_invoice", "bank_confirmation", "deposit_receipt"]);

export async function linkTransactionDocument(input: {
  clientId: string;
  actor: AgencyActor;
  transactionId: string;
  documentId?: string | null;
  storageKey?: string | null;
  category: string;
  filename?: string | null;
  visibility?: "participants" | "managers" | "finance" | null;
  milestoneId?: string | null;
  replacesDocumentLinkId?: string | null;
}) {
  const checked = await transactionAccess(input.clientId, input.actor, input.transactionId);
  if (!checked.ok) return checked;
  if (!input.documentId && !input.storageKey && !input.filename) {
    return fail("Attach the uploaded file before linking it.", 400);
  }
  const supabase = createAdminClient();
  const visibility = input.visibility ?? (FINANCE_CATEGORIES.has(input.category) ? "finance" : "participants");
  if (input.replacesDocumentLinkId) {
    const { data: previous } = await supabase
      .from("real_estate_transaction_documents")
      .select("id")
      .eq("id", input.replacesDocumentLinkId)
      .eq("client_id", input.clientId)
      .eq("transaction_id", input.transactionId)
      .maybeSingle();
    if (!previous) return fail("The document being replaced was not found on this transaction.", 404);
  }
  const base = {
    client_id: input.clientId,
    transaction_id: input.transactionId,
    document_id: input.documentId ?? null,
    category: input.category,
    filename: input.filename ?? null,
    review_status: documentReviewAfterUpload(),
    visibility,
    uploaded_by: input.actor.id,
  };
  let result = await supabase
    .from("real_estate_transaction_documents")
    .insert({
      ...base,
      storage_key: input.storageKey ?? null,
      milestone_id: input.milestoneId ?? null,
      replaces_document_link_id: input.replacesDocumentLinkId ?? null,
    })
    .select("*")
    .single();
  if (result.error && missing(result.error)) {
    if (input.storageKey) return fail("File uploads need the final corrections migration.", 503);
    result = await supabase.from("real_estate_transaction_documents").insert(base).select("*").single();
  }
  if (result.error || !result.data) return migrationFail(result.error, "Could not link the document.");
  return { ok: true as const, document: result.data, note: "Uploaded documents await review. An upload is not verification or proof of payment." };
}

export async function reviewTransactionDocument(input: {
  clientId: string;
  actor: AgencyActor;
  documentLinkId: string;
  decision: DocumentDecision;
  notes?: string | null;
  reason?: string | null;
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const caps = await staffCapabilities(input.clientId, input.actor.id, input.actor.role);
  const manager = isAgencyManager(input.actor.role);
  if (!manager && !caps.includes("review_documents")) return fail("Forbidden.", 403);
  const reason = input.reason ?? input.notes ?? null;
  const invalid = documentDecisionError(input.decision, reason);
  if (invalid) return fail(invalid, 400);
  const supabase = createAdminClient();
  const { data: doc } = await supabase
    .from("real_estate_transaction_documents")
    .select("*")
    .eq("id", input.documentLinkId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!doc) return fail("Document not found.", 404);
  if (doc.visibility === "finance" && !manager && !caps.includes("confirm_payment")) return fail("Forbidden.", 403);
  if (doc.uploaded_by === input.actor.id && !manager && input.decision === "verified") {
    return fail("Someone other than the uploader must verify this document.", 403);
  }
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    review_status: input.decision,
    reviewed_by: input.actor.id,
    notes: input.notes ?? doc.notes ?? null,
    reviewed_at: nowIso,
    rejection_reason: input.decision === "rejected" || input.decision === "replacement_requested" ? reason : null,
  };
  let result = await supabase
    .from("real_estate_transaction_documents")
    .update(patch)
    .eq("id", input.documentLinkId)
    .eq("client_id", input.clientId)
    .select("*")
    .single();
  if (result.error && missing(result.error)) {
    if (input.decision === "under_review" || input.decision === "replacement_requested") {
      return fail("This review step needs the final corrections migration.", 503);
    }
    result = await supabase
      .from("real_estate_transaction_documents")
      .update({ review_status: input.decision, reviewed_by: input.actor.id, notes: reason ?? input.notes ?? null })
      .eq("id", input.documentLinkId)
      .eq("client_id", input.clientId)
      .select("*")
      .single();
  }
  if (result.error || !result.data) {
    if (/review_status_check/i.test(result.error?.message ?? "")) {
      return fail("This review step needs the final corrections migration.", 503);
    }
    return fail(result.error?.message ?? "Document not found.", 500);
  }
  return { ok: true as const, document: result.data };
}

export async function assignMilestone(input: {
  clientId: string;
  actor: AgencyActor;
  milestoneId: string;
  assignedToId?: string | null;
  dueAt?: string | null;
  status?: "pending" | "in_progress" | "done" | "skipped" | "blocked" | null;
}) {
  if (!allowed(input.actor, input.clientId)) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const { data: milestone } = await supabase
    .from("real_estate_transaction_milestones")
    .select("id, transaction_id, milestone_key, assigned_to_id, status")
    .eq("id", input.milestoneId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!milestone) return fail("Milestone not found.", 404);
  const checked = await transactionAccess(input.clientId, input.actor, milestone.transaction_id as string);
  if (!checked.ok) return checked;
  const { access } = checked;
  const canManage = access.isManager || access.caps.includes("manage_milestones") || access.roles.includes("transaction_coordinator");
  const changingAssignment = input.assignedToId !== undefined || input.dueAt !== undefined;
  if (changingAssignment && !canManage) return fail("Only a manager or coordinator can assign milestones.", 403);
  if (input.status && !canManage && milestone.assigned_to_id !== input.actor.id) {
    return fail("Only the assignee, a coordinator or a manager can update this milestone.", 403);
  }
  if (input.assignedToId) {
    const member = await orgUser(input.clientId, input.assignedToId);
    if (!member || !member.is_active) return fail("Assign the milestone to an active team member.", 400);
  }
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: nowIso };
  if (input.assignedToId !== undefined) patch.assigned_to_id = input.assignedToId;
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;
  if (input.status) {
    patch.status = input.status;
    patch.completed_at = input.status === "done" ? nowIso : null;
  }
  const extended = input.assignedToId !== undefined ? { ...patch, assigned_by: input.actor.id, assigned_at: nowIso } : patch;
  let result = await supabase
    .from("real_estate_transaction_milestones")
    .update(extended)
    .eq("id", input.milestoneId)
    .eq("client_id", input.clientId)
    .select("*")
    .single();
  if (result.error && missing(result.error)) {
    result = await supabase
      .from("real_estate_transaction_milestones")
      .update(patch)
      .eq("id", input.milestoneId)
      .eq("client_id", input.clientId)
      .select("*")
      .single();
  }
  if (result.error || !result.data) return fail(result.error?.message ?? "Milestone not found.", 500);
  const parts: string[] = [];
  if (input.assignedToId !== undefined) parts.push(input.assignedToId ? "assigned" : "unassigned");
  if (input.dueAt !== undefined) parts.push(input.dueAt ? `due ${input.dueAt.slice(0, 10)}` : "due date cleared");
  if (input.status) parts.push(`status ${input.status}`);
  await supabase.from("real_estate_transaction_events").insert({
    transaction_id: milestone.transaction_id,
    client_id: input.clientId,
    event_type: "MILESTONE_UPDATED",
    note: `${String(milestone.milestone_key).replaceAll("_", " ")}: ${parts.join(", ")}`,
    payload: { milestone_id: input.milestoneId, assigned_to_id: input.assignedToId ?? null },
    created_by: input.actor.id,
  });
  return { ok: true as const, milestone: result.data };
}

// ---------------------------------------------------------------------------
// Manager attention
// ---------------------------------------------------------------------------

export async function agencyAttentionFeed(clientId: string, actor: AgencyActor) {
  if (!isAgencyManager(actor.role) || !allowed(actor, clientId)) return fail("Forbidden.", 403);
  const supabase = createAdminClient();
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const docCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const idleCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [mandates, listings, offers, commissions, handovers, transactions, expiring, documents] = await Promise.all([
    supabase.from("real_estate_mandates").select("id, status").eq("client_id", clientId).eq("status", "submitted").limit(20),
    supabase.from("listings").select("id, suburb, address, approval_status").eq("client_id", clientId).eq("approval_status", "pending_approval").limit(20),
    supabase.from("real_estate_offers").select("id, status").eq("client_id", clientId).in("status", ["submitted", "countered"]).limit(20),
    supabase.from("real_estate_commissions").select("id, status").eq("client_id", clientId).in("status", ["projected", "reported_received", "disputed"]).limit(20),
    supabase.from("real_estate_handovers").select("id, status").eq("client_id", clientId).eq("status", "partial").limit(10),
    supabase
      .from("real_estate_transactions")
      .select("id, status, updated_at")
      .eq("client_id", clientId)
      .in("status", ACTIVE_TXN)
      .lt("updated_at", idleCutoff)
      .limit(20),
    supabase.from("real_estate_mandates").select("id, expiry_date").eq("client_id", clientId).eq("status", "approved").gte("expiry_date", today).lte("expiry_date", soon).limit(20),
    supabase
      .from("real_estate_transaction_documents")
      .select("id, category")
      .eq("client_id", clientId)
      .in("review_status", ["awaiting_review", "under_review"])
      .lt("created_at", docCutoff)
      .limit(20),
  ]);
  const introductions = await supabase
    .from("real_estate_buyer_introductions")
    .select("id, listing_id")
    .eq("client_id", clientId)
    .eq("status", "requested")
    .order("created_at", { ascending: true })
    .limit(20);
  const introListingIds = [...new Set((introductions.data ?? []).map((row) => row.listing_id as string))];
  const { data: introListings } = introListingIds.length
    ? await supabase.from("listings").select("id, suburb, address").eq("client_id", clientId).in("id", introListingIds)
    : { data: [] };
  const introPlace = new Map(
    (introListings ?? []).map((row) => [row.id as string, (row.suburb as string) || (row.address as string) || "Property"])
  );
  const items = agencyAttention({
    mandatesPending: (mandates.data ?? []).map((row) => ({ id: row.id as string, label: "Mandate" })),
    listingsPending: (listings.data ?? []).map((row) => ({ id: row.id as string, label: (row.suburb as string) || (row.address as string) || "Listing" })),
    mandatesExpiring: (expiring.data ?? []).map((row) => ({ id: row.id as string, label: "Mandate", expiresOn: String(row.expiry_date ?? "") })),
    offersWaiting: (offers.data ?? []).map((row) => ({ id: row.id as string, label: `Offer ${row.status}` })),
    documentsOverdue: (documents.data ?? []).map((row) => ({ id: row.id as string, label: String(row.category ?? "Document") })),
    paymentsUnverified: (commissions.data ?? []).filter((row) => row.status === "reported_received").map((row) => ({ id: row.id as string, label: "Commission receipt" })),
    commissionsPending: (commissions.data ?? []).filter((row) => row.status === "projected" || row.status === "disputed").map((row) => ({ id: row.id as string, label: "Commission" })),
    handoversOpen: (handovers.data ?? []).map((row) => ({ id: row.id as string, label: "Handover" })),
    stalledTransactions: (transactions.data ?? []).map((row) => ({
      id: row.id as string,
      label: "Transaction",
      daysIdle: Math.max(14, Math.floor((Date.now() - new Date(row.updated_at as string).getTime()) / 86400000)),
    })),
    introductionsPending: (introductions.data ?? []).map((row) => ({
      id: row.id as string,
      label: introPlace.get(row.listing_id as string) ?? "Property",
    })),
  });
  return { ok: true as const, items };
}
