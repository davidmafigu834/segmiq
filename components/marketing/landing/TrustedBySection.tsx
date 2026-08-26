import { TRUSTED_CLIENTS } from "@/lib/marketing/trusted-clients";
import ClientLogo from "@/components/marketing/landing/ClientLogo";

/** Temporary layout placeholders until real client logos are supplied. */
const PLACEHOLDERS = [
  { id: "p1", width: 118 },
  { id: "p2", width: 96 },
  { id: "p3", width: 132 },
  { id: "p4", width: 108 },
  { id: "p5", width: 124 },
  { id: "p6", width: 100 },
] as const;

function LogoPlaceholder({ width }: { width: number }) {
  return (
    <div className="flex h-[54px] items-center justify-center px-3.5 sm:h-[60px] sm:px-4 md:h-[64px] md:px-[18px]">
      <div
        className="flex h-[34px] items-center justify-center rounded-md bg-[var(--marketing-hover)] opacity-70 transition-opacity duration-200 hover:opacity-100 sm:h-[38px] md:h-[40px]"
        style={{ width }}
        aria-hidden
      >
        <span className="h-2 w-[55%] rounded-full bg-[var(--marketing-border-strong)]" />
      </div>
    </div>
  );
}

export default function TrustedBySection() {
  const usePlaceholders = TRUSTED_CLIENTS.length === 0;

  return (
    <section
      className="marketing-halo marketing-halo--proof segmiq-section-rule border-t border-[var(--marketing-border-subtle)] bg-[var(--marketing-bg)]"
      aria-label="Trusted by businesses growing with SegmiQ"
    >
      <div className="mx-auto max-w-[1280px] px-6 pb-8 pt-7 sm:px-10 sm:pb-9 sm:pt-8 lg:px-12">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--marketing-olive)] sm:text-[12px]">
          Trusted by businesses growing with SegmiQ
        </p>

        <ul
          className="mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-x-2 gap-y-3 sm:mt-9 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:mt-10 lg:max-w-none lg:grid-cols-6 lg:gap-x-5"
          role="list"
        >
          {usePlaceholders
            ? PLACEHOLDERS.map((item) => (
                <li key={item.id} className="flex justify-center">
                  <LogoPlaceholder width={item.width} />
                </li>
              ))
            : TRUSTED_CLIENTS.map((client) => (
                <li key={client.name} className="flex justify-center">
                  <ClientLogo client={client} />
                </li>
              ))}
        </ul>
      </div>
    </section>
  );
}
