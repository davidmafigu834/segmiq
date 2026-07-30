import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import {
  getLocalTemplate,
  submitTemplateToMeta,
  updateLocalTemplate,
} from "@/lib/marketing/template-manager";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; templateId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const template = await getLocalTemplate(params.clientId, params.templateId);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ template });
}

const updateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
  body: z.string().min(1).max(1024).optional(),
  header: z.string().max(60).nullable().optional(),
  footer: z.string().max(60).nullable().optional(),
  buttons: z
    .array(z.object({ type: z.enum(["QUICK_REPLY", "URL"]), text: z.string().max(25) }))
    .max(3)
    .optional(),
  variableExamples: z.array(z.string()).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; templateId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (g.session.role !== "CLIENT_MANAGER" && g.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const template = await updateLocalTemplate(params.clientId, params.templateId, parsed.data);
    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; templateId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (g.session.role !== "CLIENT_MANAGER" && g.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await submitTemplateToMeta(params.clientId, params.templateId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ template: result.template, submitted: true });
}
