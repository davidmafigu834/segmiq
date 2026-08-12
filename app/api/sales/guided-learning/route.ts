import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import {
  getGuidedLearningProgress,
  upsertGuidedLearningProgress,
} from "@/lib/sales/training/progress-service";
import { normalizeProgress } from "@/lib/sales/training/engine";
import type { GuidedLearningProgress } from "@/lib/sales/training/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;
  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  try {
    const { progress, schemaMissing } = await getGuidedLearningProgress({
      userId: session!.userId,
      clientId: session!.clientId,
    });
    return NextResponse.json({ progress, schemaMissing });
  } catch (err) {
    console.error("Guided learning GET error:", err);
    return NextResponse.json({ error: "Failed to load training progress" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const guard = await requireSalesActorFromRequest(req);
  if (guard.error) return guard.error;
  const { session } = guard;
  if (!session!.clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  let body: { progress?: Partial<GuidedLearningProgress> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const progress = normalizeProgress(body.progress);
  try {
    const { schemaMissing } = await upsertGuidedLearningProgress({
      userId: session!.userId,
      clientId: session!.clientId,
      progress,
    });
    if (schemaMissing) {
      return NextResponse.json(
        {
          progress,
          schemaMissing: true,
          error: "Training progress table is not set up yet. Apply migration 089.",
          code: "GUIDED_LEARNING_SCHEMA_MISSING",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ progress, schemaMissing: false });
  } catch (err) {
    console.error("Guided learning PUT error:", err);
    return NextResponse.json({ error: "Failed to save training progress" }, { status: 500 });
  }
}
