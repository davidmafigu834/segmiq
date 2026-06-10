import { NextResponse } from "next/server";
import { z } from "zod";
import { findOnboardingToken } from "@/lib/onboarding/tokens";
import { finishOnboarding } from "@/lib/onboarding/finish";
import type { OnboardingProgress } from "@/lib/onboarding/constants";

export const dynamic = "force-dynamic";

const schema = z.object({
  password: z.string().min(8),
});

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const result = await findOnboardingToken(params.token);
  if (!result.ok) {
    const status = result.reason === "expired" ? 410 : result.reason === "used" ? 400 : 404;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const ownerEmail = result.client.owner_email;
  if (!ownerEmail) {
    return NextResponse.json({ error: "Owner email missing on client shell" }, { status: 400 });
  }

  const progress = (result.client.onboarding_progress ?? {}) as OnboardingProgress;

  const finishResult = await finishOnboarding({
    tokenRow: result.row,
    clientId: result.client.id,
    mode: result.client.mode,
    ownerEmail,
    password: parsed.data.password,
    progress,
  });

  if (!finishResult.ok) {
    return NextResponse.json({ error: finishResult.error }, { status: finishResult.status });
  }

  return NextResponse.json({
    success: true,
    email: ownerEmail,
    role: finishResult.ownerRole,
    mode: result.client.mode,
    teamInvites: finishResult.teamInviteResults,
  });
}
