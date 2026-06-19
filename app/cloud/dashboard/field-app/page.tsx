"use client";

import { AndroidAppDownload } from "@/app/cloud/components/AndroidAppDownload";

export default function FieldAppPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] px-5 py-4 pb-28 font-cloud-body lg:px-8 lg:pb-8">
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <p className="mb-1 font-cloud-body text-[10px] font-bold uppercase tracking-[0.08em] text-[#999990]">
            Mobile
          </p>
          <h1 className="font-cloud-display text-[26px] leading-tight text-[#0a0a0a]">
            Android field app
          </h1>
          <p className="mt-2 font-cloud-body text-[13px] leading-relaxed text-[#666660]">
            Install the native app on Android phones for faster photo capture and upload from the job site.
          </p>
        </div>
        <AndroidAppDownload />
      </div>
    </div>
  );
}
