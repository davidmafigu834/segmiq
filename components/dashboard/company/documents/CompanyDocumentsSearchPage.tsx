"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CommercialModulePage } from "@/components/dashboard/company/commercial/CommercialModulePage";
import { AskDocumentsComposer } from "./shared/AskDocumentsComposer";
import { DocumentSectionHeader } from "./shared/document-ui";

type Chrome = {
  companyName: string;
  companyLogoUrl?: string | null;
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: import("@/types").UserRole;
  whatsappBadge?: number;
};

export function CompanyDocumentsSearchPage({
  clientId,
  chrome,
  enabled,
}: {
  clientId: string;
  chrome: Chrome;
  enabled: boolean;
}) {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? undefined;

  useEffect(() => {
    if (initialQ) {
      document.getElementById("documents-search-input")?.focus();
    }
  }, [initialQ]);

  if (!enabled) {
    return (
      <CommercialModulePage chrome={chrome} breadcrumb="COMPANY / DOCUMENTS / SEARCH" title="Ask Documents">
        <p className="text-[13px] text-sales-text-secondary">SegmiQ Documents is not enabled.</p>
      </CommercialModulePage>
    );
  }

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="COMPANY / DOCUMENTS / SEARCH"
      title="Ask Documents"
      description="Ask questions across your company documents. Answers are grounded in document content with source citations."
    >
      <div className="mb-4">
        <Link
          href="/client/documents"
          className="text-[12px] font-medium text-sales-text-muted hover:text-sales-brand-fg"
        >
          ← Back to Documents
        </Link>
      </div>

      <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5 sm:p-6">
        <DocumentSectionHeader
          title="Document Q&A"
          subtitle="Natural-language answers with citations from contracts, policies, and other company records."
        />
        <AskDocumentsComposer clientId={clientId} initialQuestion={initialQ} />
      </div>
    </CommercialModulePage>
  );
}
