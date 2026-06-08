import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { createIncident } from "@/lib/status-admin";

export async function POST(req: Request) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const incidentBody = typeof body.body === "string" ? body.body.trim() : "";
  const severity = body.severity === "major" || body.severity === "critical" ? body.severity : "minor";

  if (!title || !incidentBody) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
  }

  try {
    const incident = await createIncident({ title, body: incidentBody, severity, componentKey: body.componentKey });
    return NextResponse.json(incident);
  } catch (e) {
    console.error("createIncident failed", e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
