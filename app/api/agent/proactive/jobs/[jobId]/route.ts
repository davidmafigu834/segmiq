import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { cancelJobs, getJob, evaluateProactiveJob } from "@/lib/agent/proactive";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { jobId: string } }) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const job = await getJob(params.jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const allowed =
    auth.role === "SUPER_ADMIN" || (auth.clientId === job.clientId && auth.role === "CLIENT_MANAGER");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const allowed =
    auth.role === "SUPER_ADMIN" ||
    (auth.clientId === job.clientId && (auth.role === "CLIENT_MANAGER" || auth.role === "SALESPERSON"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  if (parsed.data.action === "cancel") {
    await cancelJobs({
      clientId: job.clientId,
      leadId: job.leadId ?? undefined,
      quotationId: job.quotationId ?? undefined,
      appointmentId: job.appointmentId ?? undefined,
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
