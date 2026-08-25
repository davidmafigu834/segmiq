import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyBrainManager } from "@/lib/company-brain/access";
import { runCompanyBrainTest } from "@/lib/company-brain/test-run";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  leadId: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request) {
  const access = await requireCompanyBrainManager(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = await runCompanyBrainTest({
    clientId: access.clientId,
    message: parsed.data.message,
    leadId: parsed.data.leadId ?? null,
  });
  return NextResponse.json({ result });
}
