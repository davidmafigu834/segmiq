import { NextResponse } from "next/server";
import { requireCompanyBrainManager } from "@/lib/company-brain/access";
import { recordBrainAudit } from "@/lib/company-brain/audit";
import { brainCollections, replaceKnowledgeChunks } from "@/lib/company-brain/store";

export const dynamic = "force-dynamic";

const RESOURCES = [
  "customers",
  "playbooks",
  "stage-guidance",
  "service-areas",
  "appointment-types",
  "faqs",
  "examples",
  "rules",
  "escalation-rules",
  "knowledge",
] as const;
type Resource = (typeof RESOURCES)[number];

function isResource(value: string): value is Resource {
  return (RESOURCES as readonly string[]).includes(value);
}

async function updateResource(
  resource: Resource,
  clientId: string,
  id: string,
  payload: Record<string, unknown>,
  userId: string
) {
  switch (resource) {
    case "customers":
      return brainCollections.updateCustomer(clientId, id, payload);
    case "playbooks":
      return brainCollections.updatePlaybook(clientId, id, payload);
    case "stage-guidance":
      return brainCollections.upsertStage(clientId, { ...payload, id });
    case "service-areas":
      return brainCollections.updateArea(clientId, id, payload);
    case "appointment-types":
      return brainCollections.updateAppointment(clientId, id, payload);
    case "faqs":
      return brainCollections.updateFaq(clientId, id, payload, userId);
    case "examples":
      return brainCollections.updateExample(clientId, id, payload);
    case "rules":
      return brainCollections.updateRule(clientId, id, payload);
    case "escalation-rules":
      return brainCollections.updateEscalation(clientId, id, payload);
    case "knowledge": {
      const doc = await brainCollections.updateKnowledge(clientId, id, payload);
      if (typeof payload.content_text === "string") {
        await replaceKnowledgeChunks({
          clientId,
          documentId: id,
          category: doc.category,
          content: payload.content_text,
        });
      }
      return doc;
    }
  }
}

async function deleteResource(resource: Resource, clientId: string, id: string) {
  switch (resource) {
    case "customers":
      return brainCollections.deleteCustomer(clientId, id);
    case "playbooks":
      return brainCollections.deletePlaybook(clientId, id);
    case "stage-guidance":
      return brainCollections.deleteStage(clientId, id);
    case "service-areas":
      return brainCollections.deleteArea(clientId, id);
    case "appointment-types":
      return brainCollections.deleteAppointment(clientId, id);
    case "faqs":
      return brainCollections.deleteFaq(clientId, id);
    case "examples":
      return brainCollections.deleteExample(clientId, id);
    case "rules":
      return brainCollections.deleteRule(clientId, id);
    case "escalation-rules":
      return brainCollections.deleteEscalation(clientId, id);
    case "knowledge":
      return brainCollections.deleteKnowledge(clientId, id);
  }
}

export async function PATCH(req: Request, { params }: { params: { resource: string; id: string } }) {
  const access = await requireCompanyBrainManager(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!isResource(params.resource)) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  try {
    const item = await updateResource(
      params.resource,
      access.clientId,
      params.id,
      body as Record<string, unknown>,
      access.userId
    );
    await recordBrainAudit({
      clientId: access.clientId,
      actorId: access.userId,
      action: "UPDATED",
      entityType: params.resource,
      entityId: params.id,
      summary: `Updated ${params.resource}`,
    });
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { resource: string; id: string } }) {
  const access = await requireCompanyBrainManager(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!isResource(params.resource)) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  try {
    await deleteResource(params.resource, access.clientId, params.id);
    await recordBrainAudit({
      clientId: access.clientId,
      actorId: access.userId,
      action: "DELETED",
      entityType: params.resource,
      entityId: params.id,
      summary: `Deleted ${params.resource}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
