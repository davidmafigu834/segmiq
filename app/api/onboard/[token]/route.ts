import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOnboardingToken } from "@/lib/onboarding/tokens";
import {
  type OnboardingProgress,
  type OnboardingStepId,
  stepsForMode,
} from "@/lib/onboarding/constants";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const result = await findOnboardingToken(params.token);
  if (!result.ok) {
    const status = result.reason === "expired" ? 410 : result.reason === "used" ? 400 : 404;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const progress = (result.client.onboarding_progress ?? {}) as OnboardingProgress;
  const steps = stepsForMode(result.client.mode);
  const currentStep = progress.step && steps.includes(progress.step) ? progress.step : steps[0];

  return NextResponse.json({
    clientId: result.client.id,
    mode: result.client.mode,
    plan: result.client.plan,
    ownerEmail: result.client.owner_email,
    progress,
    currentStep,
    steps,
    expiresAt: result.row.expires_at,
  });
}

const saveSchema = z.object({
  step: z.enum(["company", "account", "branding", "team", "review"]),
  data: z.record(z.unknown()),
});

export async function PATCH(req: Request, { params }: { params: { token: string } }) {
  const result = await findOnboardingToken(params.token);
  if (!result.ok) {
    const status = result.reason === "expired" ? 410 : result.reason === "used" ? 400 : 404;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const parsed = saveSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { step, data } = parsed.data;
  const steps = stepsForMode(result.client.mode);
  if (!steps.includes(step as OnboardingStepId)) {
    return NextResponse.json({ error: "Invalid step for this mode" }, { status: 400 });
  }

  const existing = (result.client.onboarding_progress ?? {}) as OnboardingProgress;
  const next: OnboardingProgress = { ...existing, step };

  if (step === "company") {
    next.company = {
      ...existing.company,
      ...(data as OnboardingProgress["company"]),
    };
  } else if (step === "account") {
    next.account = {
      ...existing.account,
      ...(data as OnboardingProgress["account"]),
    };
  } else if (step === "branding") {
    next.branding = {
      ...existing.branding,
      ...(data as OnboardingProgress["branding"]),
    };
  } else if (step === "team") {
    next.team = data.team as OnboardingProgress["team"];
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({
      onboarding_progress: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", result.client.id)
    .eq("setup_status", "pending");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, progress: next });
}
