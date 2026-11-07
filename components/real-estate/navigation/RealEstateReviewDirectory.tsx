"use client";

import { useAgencyAttention } from "@/components/real-estate/agency/AgencyAttention";
import { RealEstateLinkDirectory } from "@/components/real-estate/navigation/RealEstateLinkDirectory";
import { MANAGER_REVIEW_LINKS } from "@/lib/real-estate/workspace-links";

const ATTENTION_TYPE_LIMIT = 20;

function countFor(ids: string[], prefix: string): string | null {
  const n = ids.filter((id) => id.startsWith(`${prefix}-`)).length;
  if (n === 0) return "0";
  return n >= ATTENTION_TYPE_LIMIT ? `${n}+` : String(n);
}

/** Existing review screens, with the same attention counts the agency overview already loads. */
export function RealEstateReviewDirectory({ clientId }: { clientId: string }) {
  const attention = useAgencyAttention(clientId, true);
  const ids = attention.status === "ready" ? (attention.data.items ?? []).map((item) => item.id) : [];
  const ready = attention.status === "ready";

  return (
    <RealEstateLinkDirectory
      title="Review"
      description="Mandate and listing approvals, compliance, and payments waiting for a decision."
      links={MANAGER_REVIEW_LINKS.map((link) => ({
        href: link.href,
        label: link.label,
        count: ready && link.countPrefix ? countFor(ids, link.countPrefix) : null,
      }))}
    />
  );
}
