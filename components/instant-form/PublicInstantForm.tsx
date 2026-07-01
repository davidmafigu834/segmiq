"use client";

import { InstantForm, type InstantFormConfig } from "@/components/instant-form/InstantForm";

type Props = {
  clientId: string;
  clientName: string;
  clientLogo?: string;
  formSlug: string;
  formName: string;
  config: InstantFormConfig;
};

export function PublicInstantForm({
  clientId,
  clientName,
  clientLogo,
  formSlug,
  formName,
  config,
}: Props) {
  async function handleSubmit(answers: Record<string, string>) {
    const res = await fetch(`/api/instant-forms/${formSlug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, formData: answers }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Submission failed");
    }
  }

  return (
    <InstantForm
      clientId={clientId}
      clientName={clientName}
      clientLogo={clientLogo}
      formName={formName}
      config={config}
      onSubmit={handleSubmit}
    />
  );
}
