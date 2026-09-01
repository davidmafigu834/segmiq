"use client";

import Link from "next/link";
import { CommercialModulePage } from "@/components/dashboard/company/commercial/CommercialModulePage";
import { DocumentAttentionRow } from "./shared/document-ui";
import type { DocumentsHomeSummary } from "@/lib/documents/list-service";
import type { UserRole } from "@/types";

export function CompanyDocumentsAttentionPage({
  clientId,
  chrome,
  summary,
}: {
  clientId: string;
  chrome: {
    companyName: string;
    companyLogoUrl?: string | null;
    userName: string;
    avatarUrl?: string | null;
    unreadNotifications: number;
    notificationRole: UserRole;
    whatsappBadge?: number;
  };
  summary: DocumentsHomeSummary;
}) {
  const items = [
    summary.attention.needsReview > 0
      ? {
          id: "review",
          title: "Documents need review",
          subtitle: "Classification or customer match may need confirmation",
          meta: `${summary.attention.needsReview} waiting`,
          tone: "warning" as const,
          actionLabel: "Review queue",
          href: "/client/documents?processingStatus=NEEDS_REVIEW",
        }
      : null,
    summary.attention.failed > 0
      ? {
          id: "failed",
          title: "Analysis failed",
          subtitle: "Original files are stored securely",
          meta: `${summary.attention.failed} document${summary.attention.failed === 1 ? "" : "s"}`,
          tone: "danger" as const,
          actionLabel: "View failed",
          href: "/client/documents?processingStatus=FAILED",
        }
      : null,
    summary.attention.processing > 0
      ? {
          id: "processing",
          title: "Processing in progress",
          subtitle: "SegmiQ is classifying and understanding uploads",
          meta: `${summary.attention.processing} active`,
          tone: "info" as const,
          actionLabel: "View processing",
          href: "/client/documents?processingStatus=PROCESSING",
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    tone: "warning" | "danger" | "info";
    actionLabel: string;
    href: string;
  }>;

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="COMPANY / DOCUMENTS / ATTENTION"
      title="Document attention"
      description="What needs review or action across your document library."
      titleActions={
        <Link href="/client/documents">
          <span className="text-[13px] font-medium text-sales-brand-fg hover:underline">← Documents</span>
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface px-6 py-16 text-center">
          <p className="text-[15px] font-medium text-sales-text-primary">Nothing needs attention right now</p>
          <p className="mt-2 text-[13px] text-sales-text-secondary">
            Documents requiring review, failed analysis, or processing will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <DocumentAttentionRow key={item.id} {...item} />
          ))}
        </div>
      )}
    </CommercialModulePage>
  );
}
