import { Download, Smartphone } from "lucide-react";
import {
  SALES_APP_DOWNLOAD_PATH,
  SALES_APP_FILENAME,
  SALES_APP_NAME,
} from "@/lib/sales/sales-app";

export function SalesAppDownloadButton() {
  return (
    <a
      href={SALES_APP_DOWNLOAD_PATH}
      download={SALES_APP_FILENAME}
      title={`Download ${SALES_APP_NAME} for Android`}
      aria-label={`Download ${SALES_APP_NAME} for Android`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-2.5 text-[12px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-quaternary)] sm:px-3"
    >
      <Smartphone className="hidden h-3.5 w-3.5 shrink-0 text-[var(--accent)] sm:block" strokeWidth={2} />
      <Download className="h-3.5 w-3.5 shrink-0 text-[var(--accent)] sm:hidden" strokeWidth={2.2} />
      <span className="hidden min-[380px]:inline sm:hidden">App</span>
      <span className="hidden sm:inline">Get app</span>
      <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase leading-none tracking-wide text-[var(--accent-ink)]">
        New
      </span>
    </a>
  );
}
