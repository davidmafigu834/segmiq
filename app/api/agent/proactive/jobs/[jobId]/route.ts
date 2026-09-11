import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { evaluateLeadModifyAccess, evaluateLeadReadAccess } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelJobById, getJob, evaluateProactiveJob } from "@/lib/agent/proactive";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { jobId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = await getJob(params.jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inTenant =
    (auth.role === "SUPER_ADMIN" && !auth.isImpersonating) || auth.clientId === job.clientId;
  if (!inTenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.role === "CLIENT_MANAGER" || (auth.role === "SUPER_ADMIN" && !auth.isImpersonating)) {
    return NextResponse.json({ job });
  }

  if (job.leadId) {
    const supabase = createAdminClient();
    const { data: lead } = await supabase
      .from("leads")
      .select("client_id, assigned_to_id")
      .eq("id", job.leadId)
      .maybeSingle();
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const read = evaluateLeadReadAccess(auth, {
      client_id: lead.client_id as string,
      assigned_to_id: (lead.assigned_to_id as string | null) ?? null,
    });
    if (!read.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else if (auth.role === "SALESPERSON") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ job });
}

const patchSchema = z.object({
  action: z.enum(["cancel", "evaluate"]),
  reason: z.string().max(300).optional(),
});

export async function PATCH(req: Request, { params }: { params: { jobId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = await getJob(params.jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inTenant =
    (auth.role === "SUPER_ADMIN" && !auth.isImpersonating) || auth.clientId === job.clientId;
  if (!inTenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  if (parsed.data.action === "cancel") {
    const isManager =
      auth.role === "CLIENT_MANAGER" || (auth.role === "SUPER_ADMIN" && !auth.isImpersonating);
    if (!isManager) {
      if (!job.leadId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const supabase = createAdminClient();
      const { data: lead } = await supabase
        .from("leads")
        .select("client_id, assigned_to_id")
        .eq("id", job.leadId)
        .maybeSingle();
      if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const mod = evaluateLeadModifyAccess(auth, {
        client_id: lead.client_id as string,
        assigned_to_id: (lead.assigned_to_id as string | null) ?? null,
      });
      if (!mod.allowed) {
        return NextResponse.json({ error: mod.reason }, { status: mod.status });
      }
    }

    await cancelJobById({
      jobId: job.id,
      clientId: job.clientId,
      reason: parsed.data.reason || "Cancelled from Agent activity",
      cancelledById: auth.userId,
    });
    return NextResponse.json({ ok: true });
  }

  if (auth.role === "SALESPERSON") {
    return NextResponse.json({ error: "Only managers can re-evaluate jobs" }, { status: 403 });
  }
  const result = await evaluateProactiveJob(job.id);
  return NextResponse.json({ ok: true, result });
}
