import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addProjectEquipment,
  importProjectEquipment,
  releaseProjectEquipment,
  reserveProjectEquipment,
  updateProjectEquipment,
} from "@/lib/work-projects/commercial-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["import", "add", "update", "reserve", "release"]),
  description: z.string().max(200).optional(),
  quantity: z.number().optional(),
  productId: z.string().uuid().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  equipmentId: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().optional(),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the equipment details." }, { status: 400 });
  if (body.data.action === "import") {
    const result = await importProjectEquipment(actor, params.projectId);
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (body.data.action === "add") {
    const result = await addProjectEquipment(actor, params.projectId, {
      description: body.data.description || "",
      quantity: body.data.quantity ?? 0,
      productId: body.data.productId,
      unit: body.data.unit,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data, { status: 201 });
  }
  if (body.data.action === "update") {
    if (!body.data.equipmentId) return NextResponse.json({ error: "Choose an item." }, { status: 400 });
    const result = await updateProjectEquipment(actor, params.projectId, body.data.equipmentId, body.data.quantity ?? -1);
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (body.data.action === "reserve") {
    if (!body.data.locationId) return NextResponse.json({ error: "Choose a stock location." }, { status: 400 });
    const result = await reserveProjectEquipment(actor, params.projectId, body.data.locationId);
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  const result = await releaseProjectEquipment(actor, params.projectId, body.data.equipmentId ?? null);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
