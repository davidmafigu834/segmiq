import { TRUSTED_CLIENTS } from "@/lib/marketing/trusted-clients";
import ClientLogo from "@/components/marketing/landing/ClientLogo";

export default function TrustedBySection() {
  if (TRUSTED_CLIENTS.length === 0) return null;

  return (
    <section
      className="border-t border-[var(--marketing-border-subtle)] bg-[var(--marketing-bg)]"
      aria-label="Businesses using SegmiQ"
    >
      <div className="segmiq-shell py-8 sm:py-10">
        <ul
          className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-x-5"
          role="list"
        >
          {TRUSTED_CLIENTS.map((client) => (
            <li key={client.name} className="flex justify-center">
              <ClientLogo client={client} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
