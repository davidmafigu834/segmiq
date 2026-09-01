import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { canModifyLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { convertLeadToWonCustomer } from "@/lib/sales/leads/convert-lead-won-customer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  wonValue: z.number().nonnegative(),
  wonAt: z.string().datetime().optional(),
  dealName: z.string().max(200).optional(),
  customerType: z.enum(["company", "individual"]).optional(),
  location: z.string().max(300).optional(),
  primaryContactName: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
});

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const check = await canModifyLead(params.leadId, req);
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message ?? "Invalid request", field: issue?.path[0] },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Number.isFinite(body.wonValue) || body.wonValue <= 0) {
    return NextResponse.json(
      { error: "Enter the final deal value.", field: "wonValue" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: actorRow } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", auth.userId)
    .maybeSingle();

  const result = await convertLeadToWonCustomer({
    leadId: params.leadId,
    actorId: auth.userId,
    actor: {
      id: auth.userId,
      name: (actorRow?.name as string) || "Unknown",
      role: (actorRow?.role as string) || auth.role || "UNKNOWN",
    },
    wonValue: body.wonValue,
    wonAt: body.wonAt ?? null,
    dealName: body.dealName ?? null,
    customerType: body.customerType ?? null,
    location: body.location ?? null,
    primaryContactName: body.primaryContactName ?? null,
    industry: body.industry ?? null,
    notes: body.notes ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    deal: result.deal,
    lead: result.lead,
    contactId: result.contactId,
  });
}
