"use client";

import { useState, type HTMLAttributes, type ReactNode } from "react";
import { Building2, CalendarDays, Check, Mail, MapPin, Phone, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import { Avatar, Badge, Button, IconButton, TextArea } from "@/components/sales/ui";
import { listingLabel } from "@/lib/real-estate/helpers";
import {
  viewingIsOverdue,
  viewingSentimentLabel,
  viewingSentimentTone,
  viewingStatusLabel,
  viewingStatusTone,
} from "@/lib/real-estate/viewings";
import type { ViewingWorkspaceRow } from "./types";

function Section({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-sales-border-subtle px-4 py-3.5 sm:px-5", className)} {...props} />;
}

function ActionTile({
  label,
  disabled,
  href,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  href?: string | null;
  onClick?: () => void;
  children: ReactNode;
}) {
  const classes = cn(
    "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px] border border-sales-border bg-[#151815]/[0.02] px-1 py-2 text-[11px] font-medium text-sales-text-secondary transition-colors dark:bg-[#151815]",
    disabled
      ? "cursor-not-allowed opacity-40"
      : "hover:border-sales-border-strong hover:bg-sales-surface-hover hover:text-sales-text-primary"
  );
  return href && !disabled ? (
    <a href={href} className={classes}>
      {children}
      {label}
    </a>
  ) : (
    <button type="button" className={classes} disabled={disabled} onClick={onClick}>
      {children}
      {label}
    </button>
  );
}

function Value({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-sales-text-muted">{label}</p>
      <div className={cn("mt-1 break-words text-[12px] text-sales-text-primary", strong && "font-semibold")}>
        {value}
      </div>
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ViewingDetailPanel({
  row,
  busy,
  onClose,
  onCall,
  onWhatsApp,
  onComplete,
  onCancel,
  onSaveFeedback,
  onOpenClient,
  onOpenListing,
  overlay,
  stacked,
}: {
  row: ViewingWorkspaceRow | null;
  busy: boolean;
  onClose: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onComplete: (feedback?: { text: string; sentiment: "positive" | "neutral" | "negative" | null }) => void;
  onCancel: () => void;
  onSaveFeedback: (feedback: { text: string; sentiment: "positive" | "neutral" | "negative" | null }) => void;
  onOpenClient: () => void;
  onOpenListing: () => void;
  overlay?: boolean;
  stacked?: boolean;
}) {
  const [feedbackText, setFeedbackText] = useState("");
  const [sentiment, setSentiment] = useState<"positive" | "neutral" | "negative" | "">("");
  const [showFeedback, setShowFeedback] = useState(false);

  if (!row) return null;

  const property = listingLabel({ address: row.listing_address, suburb: row.listing_suburb });
  const overdue = viewingIsOverdue(row.status, row.scheduled_at);
  const scheduled = row.status === "scheduled";
  const mailto = row.contact_email ? `mailto:${row.contact_email}` : null;
  const tel = row.contact_phone ? `tel:${row.contact_phone}` : null;

  const body = (
    <aside
      className={cn(
        "flex h-full min-h-[660px] flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card",
        overlay &&
          "fixed inset-y-0 right-0 z-[70] w-full max-w-[410px] rounded-none border-y-0 border-r-0 sm:rounded-l-[14px] sm:border-y sm:border-r",
        stacked && overlay && "inset-0 max-w-none rounded-none"
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={row.contact_name ?? "Buyer"} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-sales-text-primary">
                {row.contact_name ?? "Buyer"}
              </h2>
              <Badge tone={viewingStatusTone(row.status)} appearance="soft" className="!px-2 !py-0.5 !text-[10px]">
                {viewingStatusLabel(row.status)}
              </Badge>
              {overdue ? (
                <Badge tone="danger" appearance="soft" className="!px-2 !py-0.5 !text-[10px]">
                  Overdue
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-sales-text-muted">
              <MapPin size={12} />
              {property}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-sales-text-secondary">
              <CalendarDays size={12} />
              {formatWhen(row.scheduled_at)}
            </p>
          </div>
        </div>
        <IconButton aria-label="Close viewing details" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex gap-2 px-4 pb-4 sm:px-5">
          <ActionTile label="Call" disabled={!row.contact_phone} href={tel} onClick={onCall}>
            <Phone size={16} />
          </ActionTile>
          <ActionTile label="WhatsApp" disabled={!row.contact_phone} onClick={onWhatsApp}>
            <SiWhatsapp size={16} color="#25D366" />
          </ActionTile>
          <ActionTile label="Email" disabled={!row.contact_email} href={mailto}>
            <Mail size={16} />
          </ActionTile>
          <ActionTile label="Listing" onClick={onOpenListing}>
            <Building2 size={16} />
          </ActionTile>
        </div>

        <Section>
          <h3 className="mb-3 text-[12px] font-semibold text-sales-text-primary">Viewing overview</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Value label="When" value={formatWhen(row.scheduled_at)} strong />
            <Value label="Status" value={viewingStatusLabel(row.status)} />
            <Value label="Buyer" value={row.contact_name ?? "—"} />
            <Value label="Agent" value={row.agent_name ?? "Unassigned"} />
            <Value label="Property" value={property} />
            <Value label="Phone" value={row.contact_phone ?? "Not recorded"} />
          </div>
        </Section>

        <Section>
          <h3 className="mb-3 text-[12px] font-semibold text-sales-text-primary">Feedback</h3>
          {row.feedback_text ? (
            <div className="space-y-2">
              <Badge tone={viewingSentimentTone(row.feedback_sentiment)} appearance="soft">
                {viewingSentimentLabel(row.feedback_sentiment)}
              </Badge>
              <p className="text-[13px] leading-relaxed text-sales-text-secondary">{row.feedback_text}</p>
            </div>
          ) : showFeedback ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["positive", "neutral", "negative"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSentiment(option)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12px] capitalize",
                      sentiment === option
                        ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                        : "border-sales-border text-sales-text-secondary hover:text-sales-text-primary"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <TextArea
                rows={3}
                placeholder="How did the viewing go?"
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
              />
            </div>
          ) : (
            <p className="text-[12px] text-sales-text-muted">
              {scheduled ? "No notes yet. Complete the viewing to record feedback." : "No notes recorded."}
            </p>
          )}
        </Section>
      </div>

      <div className="flex flex-col gap-2 border-t border-sales-border-subtle p-4">
        {scheduled ? (
          <>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              disabled={busy}
              leftIcon={<Check size={15} />}
              onClick={() => {
                if (!showFeedback) {
                  setShowFeedback(true);
                  return;
                }
                onComplete({
                  text: feedbackText.trim(),
                  sentiment: sentiment || null,
                });
                setShowFeedback(false);
                setFeedbackText("");
                setSentiment("");
              }}
            >
              {showFeedback ? "Save and complete" : "Complete viewing"}
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="md" className="flex-1" onClick={onOpenClient}>
                Open client
              </Button>
              <Button variant="secondary" size="md" className="flex-1" disabled={busy} onClick={onCancel}>
                Cancel viewing
              </Button>
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" size="md" className="flex-1" onClick={onOpenClient}>
              Open client
            </Button>
            {row.status === "completed" && !row.feedback_text ? (
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  if (!showFeedback) {
                    setShowFeedback(true);
                    return;
                  }
                  onSaveFeedback({
                    text: feedbackText.trim(),
                    sentiment: sentiment || null,
                  });
                  setShowFeedback(false);
                  setFeedbackText("");
                  setSentiment("");
                }}
              >
                {showFeedback ? "Save notes" : "Add feedback"}
              </Button>
            ) : (
              <Button variant="primary" size="md" className="flex-1" onClick={onOpenListing}>
                Open listing
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {overlay ? (
        <button
          type="button"
          aria-label="Close viewing details"
          className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
          onClick={onClose}
        />
      ) : null}
      {body}
    </>
  );
}
