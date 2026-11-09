"use client";

import { ViewingRequestForm, type ViewingFormPreview } from "@/components/real-estate/workflow/ViewingRequestForm";
import { OfferLetterForm, type OfferLetterPreview } from "@/components/real-estate/workflow/OfferLetterForm";
import { useEffect, useState } from "react";
import styles from "@/components/real-estate/workflow/viewing-request-form.module.css";

export default function JourneyFormPage({ params }: { params: { token: string } }) {
  const [preview, setPreview] = useState<OfferLetterPreview | null>(null);

  useEffect(() => {
    void fetch(`/api/public/journey/${params.token}`, { cache: "no-store" }).then(async (response) => {
      setPreview((await response.json()) as OfferLetterPreview);
    });
  }, [params.token]);

  if (!preview) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <p className={styles.lead}>Loading</p>
        </div>
      </main>
    );
  }

  if (preview.purpose === "offer_buyer" || preview.purpose === "offer_seller") {
    return <OfferLetterForm token={params.token} preview={preview} />;
  }

  return <ViewingRequestForm token={params.token} preview={preview as ViewingFormPreview} />;
}
