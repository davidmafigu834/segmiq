import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { RecordFrame } from "@/components/platform/workbench";

export default function PlatformUploadPage() {
  return (
    <AgencyLayout breadcrumb="Configuration / Upload" pageTitle="Upload">
      <RecordFrame
        detail="Photos and video belong to an organisation project. The uploader is the cloud tool, and it stays outside this console."
        fact={{
          name: "Open the uploader when the project already exists.",
          detail: "Create the organisation and the project first. Then send the files there.",
          action: "Open organisations",
          href: "/dashboard/clients",
        }}
      >
        <p className="text-[14px] text-[var(--text-secondary)]">
          <a className="font-semibold text-[var(--text-primary)] underline decoration-[var(--border)] underline-offset-4" href="/cloud/dashboard/upload">
            Open the cloud uploader
          </a>
        </p>
      </RecordFrame>
    </AgencyLayout>
  );
}
