import Image from "next/image";
import Link from "next/link";
import { Camera, CircleCheck, FolderOpen, Share2 } from "lucide-react";

const OUTCOMES = [
  "Upload job photos from phone or desktop",
  "Organized project workspaces",
  "Client-ready share links",
  "One place for completed project records",
] as const;

/** Left brand panel for SegmiQ Cloud auth (field documentation product). */
export default function CloudAuthMarketingPanel() {
  return (
    <aside className="auth-marketing relative hidden h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--marketing-bg)] lg:flex">
      <div className="auth-marketing-halo pointer-events-none absolute inset-0" aria-hidden />

      <header className="auth-panel-header relative z-[1] flex h-14 shrink-0 items-center px-10 xl:px-14">
        <Link href="/cloud" className="inline-flex items-center gap-3">
          <Image
            src="/brand/segmiq-q.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-[11px] object-cover"
            priority
          />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--marketing-text)]">
            SegmiQ Cloud
          </span>
        </Link>
      </header>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden px-10 pb-8 pt-1 xl:px-14">
        <div className="max-w-[520px] shrink-0">
          <div className="inline-flex h-7 items-center gap-2 rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface-elevated)] px-3 text-[11px] font-medium text-[var(--marketing-text-secondary)]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--marketing-brand)]"
              aria-hidden
            />
            Field documentation platform
          </div>

          <h2
            className="mt-3.5 text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--marketing-text-heading)] xl:text-[38px]"
            style={{ fontWeight: 650 }}
          >
            Your projects. In the cloud.
          </h2>

          <p className="mt-2.5 max-w-[440px] text-[14px] leading-[1.5] text-[var(--marketing-text-secondary)]">
            Upload job photos from site, organise by project, and share polished galleries with
            clients in one link.
          </p>

          <ul className="mt-4 max-w-[420px] space-y-2">
            {OUTCOMES.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CircleCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-olive)]"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="text-[13px] leading-snug text-[var(--marketing-text-label)]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto grid max-w-[360px] shrink-0 grid-cols-3 gap-2.5 pt-6">
          {[
            { Icon: Camera, label: "Capture" },
            { Icon: FolderOpen, label: "Organise" },
            { Icon: Share2, label: "Share" },
          ].map(({ Icon, label }) => (
            <div
              key={label}
              className="rounded-[12px] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-2.5 py-3 text-center shadow-[var(--marketing-card-shadow)]"
            >
              <Icon
                className="mx-auto h-4 w-4 text-[var(--marketing-olive)]"
                strokeWidth={1.8}
                aria-hidden
              />
              <p className="mt-1.5 text-[11px] font-medium text-[var(--marketing-text-secondary)]">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
