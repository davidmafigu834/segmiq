"use client";

import { Download, Smartphone } from "lucide-react";
import {
  FIELD_APP_DOWNLOAD_PATH,
  FIELD_APP_FILENAME,
  FIELD_APP_INSTALL_STEPS,
  FIELD_APP_NAME,
  FIELD_APP_VERSION,
} from "@/lib/cloud/field-app";

type AndroidAppDownloadProps = {
  variant?: "card" | "section";
};

const downloadBtnCls =
  "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-opacity font-cloud-body cursor-pointer bg-[var(--fw-soil)] text-[var(--fw-lime)]";

export function AndroidAppDownload({ variant = "section" }: AndroidAppDownloadProps) {
  if (variant === "card") {
    return (
      <div className="rounded-[18px] border border-[var(--fw-border)] bg-[var(--fw-card)] p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--fw-border-strong)] bg-[var(--fw-sunken)]">
          <Smartphone className="h-5 w-5 text-[var(--fw-text-primary)]" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-cloud-display text-[15px] leading-tight text-[var(--fw-text-primary)]">
            {FIELD_APP_NAME}
          </p>
          <p className="mt-0.5 font-cloud-body text-[11px] text-[var(--fw-text-tertiary)]">
            Android field app · v{FIELD_APP_VERSION}
          </p>
        </div>
        <a
          href={FIELD_APP_DOWNLOAD_PATH}
          download={FIELD_APP_FILENAME}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] border border-[var(--fw-border-strong)] bg-[var(--fw-sunken)] px-3 font-cloud-body text-[11px] font-bold text-[var(--fw-text-primary)]"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>
      </div>
    );
  }

  const sectionCardCls =
    "rounded-[20px] border p-5 space-y-4 bg-white border-[var(--fw-border)]";

  return (
    <section>
      <p className="mb-3 font-cloud-body text-[10px] font-bold uppercase tracking-[0.08em] text-[#999990]">
        Android field app
      </p>
      <div className={sectionCardCls}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1C1410]">
            <Smartphone className="h-5 w-5 text-[#D4FF4F]" strokeWidth={1.6} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-cloud-body text-[14px] font-semibold text-[#0a0a0a]">{FIELD_APP_NAME}</p>
            <p className="mt-1 font-cloud-body text-[12px] leading-relaxed text-[#999990]">
              Capture and upload job-site photos from Android. Uses the same login as this dashboard.
            </p>
            <p className="mt-2 font-cloud-body text-[11px] text-[#BBBBAA]">Version {FIELD_APP_VERSION}</p>
          </div>
        </div>

        <a href={FIELD_APP_DOWNLOAD_PATH} download={FIELD_APP_FILENAME} className={downloadBtnCls}>
          <Download className="h-3.5 w-3.5" />
          Download Android app
        </a>

        <div className="space-y-2 border-t border-black/[0.06] pt-4">
          <p className="font-cloud-body text-[11px] font-semibold uppercase tracking-[0.06em] text-[#666660]">
            Install steps
          </p>
          <ol className="space-y-2">
            {FIELD_APP_INSTALL_STEPS.map((step, index) => (
              <li key={step} className="flex gap-2.5 font-cloud-body text-[12px] leading-relaxed text-[#666660]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5F5F0] text-[10px] font-bold text-[#0a0a0a]">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
