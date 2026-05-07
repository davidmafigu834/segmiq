"use client";

import { useState } from "react";
import Link from "next/link";
import { CloudUpload, ChevronDown, Mail } from "lucide-react";

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
    a: "Open the project, tap the three-dot menu (⋮), and select Delete project. All photos in the project will also be deleted. This action cannot be undone.",
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
    <button
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left"
    >
      <div className={`rounded-2xl border transition-colors ${open ? "border-white/15 bg-[#111]" : "border-white/[0.08] bg-[#0d0d0d] hover:bg-[#111]"}`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <span className="text-[14px] font-medium text-white leading-snug">{q}</span>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
        {open && (
          <div className="border-t border-white/[0.08] px-5 py-4">
            <p className="text-[13px] leading-relaxed text-white/60">{a}</p>
          </div>
        )}
      </div>
    </button>
  );
}

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/cloud" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D4FF4F]">
              <CloudUpload className="h-4 w-4 text-black" strokeWidth={2.5} />
            </div>
            <span className="text-[14px] font-semibold text-white">Leadstaq Cloud</span>
          </Link>
          <Link
            href="/cloud/dashboard"
            className="text-[13px] text-white/40 hover:text-white transition-colors"
          >
            Back to dashboard →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10">
          <h1 className="mb-2 text-[28px] font-semibold text-white">Help centre</h1>
          <p className="text-[14px] text-white/50">
            Frequently asked questions about Leadstaq Cloud.
          </p>
        </div>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <Accordion key={i} q={faq.q} a={faq.a} />
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-white/[0.08] bg-[#111] p-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
              <Mail className="h-5 w-5 text-white/40" strokeWidth={1.5} />
            </div>
          </div>
          <p className="mb-1 text-[14px] font-medium text-white">Still need help?</p>
          <p className="mb-4 text-[13px] text-white/40">
            Our support team typically replies within 24 hours.
          </p>
          <a
            href="mailto:support@leadstaq.tech"
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4FF4F] px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-[#c4ef3f] transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            support@leadstaq.tech
          </a>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-6">
        <div className="mx-auto max-w-3xl px-6 text-center text-[12px] text-white/25">
          <Link href="/cloud" className="hover:text-white/50 transition-colors">Leadstaq Cloud</Link>
          {" · "}
          <a href="mailto:support@leadstaq.tech" className="hover:text-white/50 transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  );
}
