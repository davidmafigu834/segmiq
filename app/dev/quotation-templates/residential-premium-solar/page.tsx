import { notFound } from "next/navigation";
import { solarTemplateFixture, SOLAR_TEMPLATE_FIXTURE_KINDS } from "@/lib/quotations/layouts/fixtures";
import { ResidentialPremiumSolarDigital } from "@/components/quotations/layouts/ResidentialPremiumSolarDigital";

const LABELS: Record<(typeof SOLAR_TEMPLATE_FIXTURE_KINDS)[number], string> = {
  populated: "Full populated",
  minimal: "Minimal",
  long: "Long content",
  multipage: "Multi-page terms",
};

export default function ResidentialPremiumSolarRegressionPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen bg-[#F4F4F4] px-4 py-8 text-[#1A1A1A]">
      <div className="mx-auto max-w-[1400px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B6B6B]">
          Development only
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Residential Premium Solar — visual fixtures</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#6B6B6B]">
          Fixture data only. These states are not production customer quotations. PDFs use the same layout
          renderer as production; the digital twin below uses public hero URLs so the page stays light.
        </p>
        <div className="mt-6 space-y-10">
          {SOLAR_TEMPLATE_FIXTURE_KINDS.map((kind) => {
            const digital = solarTemplateFixture(kind, { heroAsUrl: true });
            return (
              <section key={kind} className="rounded-xl border border-[#E4E4E4] bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">{LABELS[kind]}</h2>
                  <a
                    href={`/dev/quotation-templates/residential-premium-solar/pdf/${kind}`}
                    className="text-sm font-medium underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open PDF
                  </a>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <iframe
                    title={`${kind} PDF`}
                    src={`/dev/quotation-templates/residential-premium-solar/pdf/${kind}`}
                    className="h-[920px] w-full rounded border border-[#E4E4E4] bg-[#D9D9D9]"
                  />
                  <div className="overflow-auto rounded border border-[#E4E4E4]">
                    <ResidentialPremiumSolarDigital model={digital} />
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
