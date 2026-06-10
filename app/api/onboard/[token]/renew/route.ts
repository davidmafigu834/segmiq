import { NextResponse } from "next/server";
import { renewOnboardingToken } from "@/lib/onboarding/tokens";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const result = await renewOnboardingToken(params.token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    renewed: result.renewed,
    link: result.link,
    emailSent: result.emailSent,
  });
}
