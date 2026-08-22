import { notFound } from "next/navigation";
import { SOLAR_TEMPLATE_FIXTURE_KINDS, solarTemplateFixture } from "@/lib/quotations/layouts/fixtures";
import { renderLayoutPdf } from "@/lib/quotations/layouts/residential-premium-solar-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Kind = (typeof SOLAR_TEMPLATE_FIXTURE_KINDS)[number];

function isKind(value: string): value is Kind {
  return (SOLAR_TEMPLATE_FIXTURE_KINDS as readonly string[]).includes(value);
}

export async function GET(_req: Request, { params }: { params: { variant: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  if (!isKind(params.variant)) notFound();

  const buffer = await renderLayoutPdf(solarTemplateFixture(params.variant));
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="residential-premium-solar-${params.variant}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
