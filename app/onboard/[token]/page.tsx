import { findOnboardingToken } from "@/lib/onboarding/tokens";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { OnboardingExpired } from "@/components/onboarding/OnboardingExpired";
import { OnboardingError } from "@/components/onboarding/OnboardingError";
import type { OnboardingProgress, OnboardingStepId } from "@/lib/onboarding/constants";
import { stepsForMode } from "@/lib/onboarding/constants";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function OnboardPage({ params }: { params: { token: string } }) {
  const result = await findOnboardingToken(params.token);

  if (!result.ok) {
    if (result.reason === "expired") {
      return <OnboardingExpired token={params.token} />;
    }
    if (result.reason === "used") {
      return (
        <OnboardingError message="This onboarding link has already been used. Sign in or ask your agency for a new invite." />
      );
    }
    return (
      <OnboardingError message="This onboarding link is invalid. Check the URL or contact your agency." />
    );
  }

  if (result.client.setup_status === "active") {
    return (
      <OnboardingError message="This client has already completed setup. You can sign in at the login page." />
    );
  }

  const progress = (result.client.onboarding_progress ?? {}) as OnboardingProgress;
  const steps = stepsForMode(result.client.mode);
  const currentStep =
    progress.step && steps.includes(progress.step as OnboardingStepId)
      ? (progress.step as OnboardingStepId)
      : steps[0];

  const ownerEmail = result.client.owner_email;
  if (!ownerEmail) {
    return <OnboardingError message="This invite is missing an owner email. Contact your agency." />;
  }

  return (
    <OnboardingWizard
      token={params.token}
      mode={result.client.mode}
      ownerEmail={ownerEmail}
      initialProgress={progress}
      initialStep={currentStep}
    />
  );
}
