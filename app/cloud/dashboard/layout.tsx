import { FieldAppDownloadBar } from "./FieldAppDownloadBar";
import CloudDashboardShell from "./CloudDashboardShell";
import { headers } from "next/headers";

export default function CloudDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "";
  const showBanner =
    !pathname.includes("/field-app") &&
    !pathname.includes("/onboarding");

  return (
    <CloudDashboardShell banner={showBanner ? <FieldAppDownloadBar /> : null}>
      {children}
    </CloudDashboardShell>
  );
}
