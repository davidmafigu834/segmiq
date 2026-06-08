import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { updateSubmissionStatus, type SubmissionStatus } from "@/lib/marketing-submissions";

const STATUSES: SubmissionStatus[] = ["new", "contacted", "converted", "archived"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));
  const status = body.status as SubmissionStatus;
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    await updateSubmissionStatus(params.id, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("updateSubmissionStatus failed", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
