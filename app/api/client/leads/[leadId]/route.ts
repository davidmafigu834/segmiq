import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-guards";
import { canReassignLeads } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { background } from "@/lib/background";
import { logStatusChanged } from "@/lib/lead-events";
import { getCompanyLeadDetail } from "@/lib/sales/get-company-leads-page-data";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { leadId: string } }
) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const clientId =
    new URL(req.url).searchParams.get("clientId") || session!.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (session!.role === "CLIENT_MANAGER" && session!.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const detail = await getCompanyLeadDetail({
      clientId,
      leadId: params.leadId,
      actor: {
        userId: session!.userId,
        role: session!.role,
        clientId: session!.clientId,
        alsoSells: Boolean(session!.alsoSells),
      },
    });
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ detail });
  } catch (err) {
    console.error("[client/leads/lead]", err);
    return NextResponse.json({ error: "Failed to load Lead" }, { status: 500 });
  }
}

const patchSchema = z.object({
  status: z.enum(["NOT_QUALIFIED"]).optional(),
  not_qualified_reason: z.string().max(2000).nullable().optional(),
});

/** Company manager actions that do not require salesperson ownership. */
export async function PATCH(
  req: Request,
  { params }: { params: { leadId: string } }
) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, status")
    .eq("id", params.leadId)
    .maybeSingle();

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    session!.role === "CLIENT_MANAGER" &&
    session!.clientId !== (lead.client_id as string)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canReassignLeads(session!, lead.client_id as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.status !== "NOT_QUALIFIED") {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const previousStatus = lead.status as string;
  const updates: Record<string, unknown> = {
    status: "NOT_QUALIFIED",
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.not_qualified_reason !== undefined) {
    updates.not_qualified_reason = parsed.data.not_qualified_reason;
  }

  const { data: updated, error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", params.leadId)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  if (previousStatus !== "NOT_QUALIFIED") {
    const { data: actorUser } = await supabase
      .from("users")
      .select("name")
      .eq("id", session!.userId)
      .maybeSingle();
    background("logStatusChanged", () =>
      logStatusChanged({
        leadId: params.leadId,
        clientId: lead.client_id as string,
        actor: {
          id: session!.userId,
          name: (actorUser as { name: string } | null)?.name || "Manager",
          role: session!.role ?? "CLIENT_MANAGER",
        },
        fromStatus: previousStatus,
        toStatus: "NOT_QUALIFIED",
      })
    );
  }

  return NextResponse.json({ lead: updated });
}
