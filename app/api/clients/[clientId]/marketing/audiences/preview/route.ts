import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { resolveSegmentAudience } from "@/lib/marketing/audience-resolver";

export const dynamic = "force-dynamic";

const previewSchema = z.object({
  segmentId: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const parsed = previewSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { recipients, preview } = await resolveSegmentAudience(
      params.clientId,
      parsed.data.segmentId
    );

    return NextResponse.json({
      preview,
      eligibleCount: recipients.filter((r) => r.consentStatus === "opted_in").length,
      sample: recipients.slice(0, 5).map((r) => ({
        name: r.name,
        phone: r.phone,
        consentStatus: r.consentStatus,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve audience";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
