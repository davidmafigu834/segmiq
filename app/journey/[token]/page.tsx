"use client";

import { useEffect, useState } from "react";
import { OfferLetterForm, type OfferLetterPreview } from "@/components/real-estate/workflow/OfferLetterForm";
import { PublicJourneyShell, ViewingAcknowledgementForm } from "@/components/real-estate/workflow/ViewingAcknowledgementForm";

export default function JourneyFormPage({ params }: { params: { token: string } }) {
  const [preview, setPreview] = useState<OfferLetterPreview | null>(null);

  useEffect(() => {
    void fetch(`/api/public/journey/${params.token}`, { cache: "no-store" }).then(async (response) => {
      setPreview((await response.json()) as OfferLetterPreview);
    });
  }, [params.token]);

  if (!preview) {
    return (
      <PublicJourneyShell>
        <p className="text-[15px] text-sales-text-secondary">Loading the form.</p>
      </PublicJourneyShell>
    );
  }

  if (preview.purpose === "offer_buyer" || preview.purpose === "offer_seller") {
    return <OfferLetterForm token={params.token} preview={preview} />;
  }

  if (preview.error) {
    return (
      <PublicJourneyShell>
        <section className="max-w-lg rounded-[12px] border border-sales-border bg-sales-surface px-5 py-5">
          <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em]">This form is not available</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-sales-text-secondary">{preview.error}</p>
        </section>
      </PublicJourneyShell>
    );
  }

  return <ViewingAcknowledgementForm token={params.token} preview={preview} />;
}
