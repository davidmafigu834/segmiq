import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { loadTemplateWithItems } from "@/lib/quotations/templates";
import { parseVirtualBuiltinId } from "@/lib/quotations/layouts/ensure-builtin";
import {
  buildSolarTemplatePreviewModel,
  canPreviewTemplateLayout,
} from "@/lib/quotations/layouts/preview-model";
import { renderLayoutPdf } from "@/lib/quotations/layouts/residential-premium-solar-pdf";
import { RESIDENTIAL_PREMIUM_SOLAR_KEY } from "@/lib/quotations/layouts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; templateId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const virtualKey = parseVirtualBuiltinId(params.templateId);
  let layoutKey: string | null = virtualKey;

  if (!layoutKey) {
    const template = await loadTemplateWithItems(supabase, params.templateId);
    if (!template || template.client_id !== params.clientId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    layoutKey =
      (template.layout_key as string | null) || (template.builtin_key as string | null);
  }

  if (!canPreviewTemplateLayout(layoutKey, virtualKey === RESIDENTIAL_PREMIUM_SOLAR_KEY ? virtualKey : layoutKey)) {
    return NextResponse.json({ error: "This template has no visual preview" }, { status: 400 });
  }

  const model = await buildSolarTemplatePreviewModel(supabase, params.clientId);
  const format = new URL(req.url).searchParams.get("format");
  if (format === "pdf") {
    const buffer = await renderLayoutPdf(model);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="residential-premium-solar-preview.pdf"',
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ model, sample: true });
}
