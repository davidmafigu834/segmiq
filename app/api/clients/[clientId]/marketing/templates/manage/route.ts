import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import {
  createLocalTemplate,
  listLocalTemplates,
} from "@/lib/marketing/template-manager";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const templates = await listLocalTemplates(params.clientId);
  return NextResponse.json({ templates });
}

const createSchema = z.object({
  displayName: z.string().min(1).max(200),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("MARKETING"),
  language: z.string().default("en"),
  body: z.string().min(1).max(1024),
  header: z.string().max(60).nullable().optional(),
  footer: z.string().max(60).nullable().optional(),
  buttons: z
    .array(z.object({ type: z.enum(["QUICK_REPLY", "URL"]), text: z.string().max(25) }))
    .max(3)
    .optional(),
  variableExamples: z.array(z.string()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (g.session.role !== "CLIENT_MANAGER" && g.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const template = await createLocalTemplate(params.clientId, {
      ...parsed.data,
      createdBy: g.session.userId,
    });
    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create template";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
