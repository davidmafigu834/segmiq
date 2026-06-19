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
  variant?: "banner" | "section";
};

const downloadBtnCls =
  "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-opacity font-cloud-body cursor-pointer bg-[var(--fw-soil)] text-[var(--fw-lime)]";

export function AndroidAppDownload({ variant = "section" }: AndroidAppDownloadProps) {
  if (variant === "banner") {
    const F = "var(--fw-font-body), system-ui, sans-serif";
    const S = "var(--fw-font-display), Georgia, serif";

    return (
      <div
        style={{
          borderRadius: 20,
          background: "#1C1410",
          border: "0.5px solid rgba(255,255,255,0.08)",
          padding: "16px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -20,
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: "rgba(212,255,79,0.08)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: "rgba(212,255,79,0.15)",
            border: "0.5px solid rgba(212,255,79,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Smartphone size={22} color="#D4FF4F" strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: S, fontSize: 16, color: "#FFFFFF", margin: "0 0 3px", lineHeight: 1.2 }}>
            {FIELD_APP_NAME}
          </p>
          <p style={{ fontFamily: F, fontSize: 11, color: "rgba(255,255,255,0.55)", margin: 0 }}>
            Download for Android · v{FIELD_APP_VERSION}
          </p>
        </div>
        <a
          href={FIELD_APP_DOWNLOAD_PATH}
          download={FIELD_APP_FILENAME}
          style={{
            height: 36,
            padding: "0 14px",
            borderRadius: 12,
            background: "#D4FF4F",
            color: "#1C1410",
            fontFamily: F,
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          <Download size={14} strokeWidth={2.2} />
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
