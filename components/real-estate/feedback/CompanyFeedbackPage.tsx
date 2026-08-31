"use client";

import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { FeedbackWorkspace } from "@/components/real-estate/FeedbackWorkspace";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

type ViewingFeedback = {
  id: string;
  scheduled_at: string;
  feedback_text: string | null;
  feedback_sentiment: string | null;
  contact_name: string | null;
  agent_name: string | null;
  listing_address: string | null;
  listing_suburb: string | null;
};

export function CompanyFeedbackPage({
  chrome,
  clientId,
  viewings,
}: {
  chrome: CompanyPageChrome;
  clientId: string;
  viewings: ViewingFeedback[];
}) {
  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Feedback"
      title="Feedback"
      description="Viewing comments, complaints and testimonials for the company owner."
      primaryAction={null}
    >
      <FeedbackWorkspace clientId={clientId} viewings={viewings} />
    </CompanyRePageFrame>
  );
}
