"use client";

import { useState } from "react";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import { CloudPage } from "@/app/cloud/components/CloudPage";

const FAQS = [
  {
    q: "How do I upload photos to a project?",
    a: "Go to Upload in the navigation, select an existing project or create a new one, then pick photos from your device. Photos upload in the background — you'll see a progress bar for each.",
  },
  {
    q: "Can I share my project gallery with clients?",
    a: "Yes. Open any project and tap the Share link button. This copies a public link your client can open without logging in. Each project has a unique shareable URL.",
  },
  {
    q: "How do I add my business logo?",
    a: "Go to Settings → scroll to the Watermark section. You can enable watermarking and your logo will appear as an overlay on shared project photos. Upload your logo in the Business profile section.",
  },
  {
    q: "How do I invite team members?",
    a: "Open Team from the sidebar and click Invite member. Enter their name, email, phone, and select a role. They'll receive an email with a temporary password to log in.",
  },
  {
    q: "What happens if I run out of storage?",
    a: "New uploads will be blocked once you reach your plan's limit. You can upgrade your plan under Billing to get more storage. Your existing photos and projects are not deleted.",
  },
  {
    q: "How do I make my public profile visible?",
    a: "Go to Settings → Public profile → toggle Profile published to on. Your profile URL shows at the top of that section once it's published.",
  },
  {
    q: "Can I reorder photos within a project?",
    a: "Yes. Open a project and drag-and-drop photos to rearrange them. The first photo becomes the cover image shown in the gallery.",
  },
  {
    q: "How do I delete a project?",
    a: "Open the project, tap the three-dot menu, and select Delete project. All photos in the project will also be deleted. This action cannot be undone.",
  },
  {
    q: "What file types can I upload?",
    a: "We support JPEG, PNG, WebP, HEIC, and HEIF. Maximum file size per photo is 25 MB. Videos are not supported yet.",
  },
  {
    q: "How do I reset my password?",
    a: "Go to the sign-in page and click 'Forgot password?'. Enter your email address and we'll send you a reset link valid for 1 hour.",
  },
];

function Accordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`cloud-card overflow-hidden transition-colors ${open ? "border-[var(--cloud-border-hover)]" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-[var(--cloud-text-primary)]">
          {q}
        </span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-[var(--cloud-text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.8}
        />
      </button>
      {open ? (
        <div className="border-t border-[var(--cloud-border)] px-5 py-4">
          <p className="text-[13px] leading-relaxed text-[var(--cloud-text-secondary)]">{a}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function CloudHelpPage() {
  return (
    <CloudPage>
      <div className="mb-8">
        <p className="cloud-section-label">Support</p>
        <h1 className="font-cloud-display text-[clamp(26px,4vw,34px)] leading-[1.1] tracking-[-0.02em] text-[var(--cloud-text-primary)]">
          Help centre
        </h1>
        <p className="mt-2 max-w-xl text-[13px] text-[var(--cloud-text-secondary)]">
          Answers to common questions about SegmiQ Cloud.
        </p>
      </div>

      <div className="space-y-2">
        {FAQS.map((faq) => (
          <Accordion key={faq.q} q={faq.q} a={faq.a} />
        ))}
      </div>

      <div className="cloud-card mt-10 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--cloud-surface-muted)]">
              <MessageCircle className="h-5 w-5 text-[var(--cloud-text-secondary)]" strokeWidth={1.7} />
            </div>
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--cloud-text-primary)]">
              Still need help?
            </p>
            <p className="mt-1 text-[13px] text-[var(--cloud-text-secondary)]">
              Our support team typically replies within 24 hours.
            </p>
          </div>
          <a
            href="mailto:support@leadstaq.tech"
            className="cloud-btn-primary shrink-0"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={2.2} />
            support@leadstaq.tech
          </a>
        </div>
      </div>
    </CloudPage>
  );
}
