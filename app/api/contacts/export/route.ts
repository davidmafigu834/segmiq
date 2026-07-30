import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseLifecycleFilter } from "@/lib/customer-hub/contact-filters";
import { CONTACT_LIFECYCLE_LABELS, isContactLifecycle, type ContactLifecycle } from "@/lib/customer-hub/lifecycle";

export const dynamic = "force-dynamic";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(req: Request) {
  const g = await requireSession();
  if ("error" in g) return g.error;
  const { session } = g;

  const url = new URL(req.url);
  const requestedClientId =
    session.role === "SUPER_ADMIN" ? url.searchParams.get("clientId") : session.clientId;
  if (!requestedClientId) {
    return NextResponse.json({ error: "Missing client context" }, { status: 400 });
  }
  if (!canAccessClient(session.role, session.clientId, requestedClientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lifecycle = parseLifecycleFilter(url.searchParams.get("lifecycle"));
  const q = (url.searchParams.get("q") ?? "").trim().replace(/[,()%*\\:]/g, "");

  const supabase = createAdminClient();
  let query = supabase
    .from("contacts")
    .select("id, name, phone, email, source, lifecycle, created_at")
    .eq("client_id", requestedClientId);

  if (lifecycle && lifecycle !== "lead") {
    query = query.eq("lifecycle", lifecycle);
  } else if (lifecycle === "lead") {
    query = query.in("lifecycle", ["cold", "aware", "pipeline"]);
  }

  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  query = query.order("updated_at", { ascending: false }).limit(5000);

  const { data: contacts, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Could not export contacts" }, { status: 500 });
  }

  const ids = (contacts ?? []).map((c) => c.id as string);
  const ownerByContact = new Map<string, string | null>();
  if (ids.length) {
    const { data: leadRows } = await supabase
      .from("leads")
      .select("contact_id, assigned_to:users!assigned_to_id ( name )")
      .in("contact_id", ids)
      .order("created_at", { ascending: false });
    for (const lr of leadRows ?? []) {
      if (!lr.contact_id || ownerByContact.has(lr.contact_id as string)) continue;
      const a = lr.assigned_to as { name?: string } | { name?: string }[] | null | undefined;
      const owner = Array.isArray(a) ? (a[0]?.name ?? null) : (a?.name ?? null);
      ownerByContact.set(lr.contact_id as string, owner);
    }
  }

  const header = ["name", "phone", "email", "source", "lifecycle", "owner", "created_at"];
  const lines = [header.join(",")];

  for (const c of contacts ?? []) {
    const lifecycleKey: ContactLifecycle = isContactLifecycle(String(c.lifecycle))
      ? (c.lifecycle as ContactLifecycle)
      : "cold";
    lines.push(
      [
        csvEscape(String(c.name ?? "")),
        csvEscape(String(c.phone ?? "")),
        csvEscape(String(c.email ?? "")),
        csvEscape(String(c.source ?? "")),
        csvEscape(CONTACT_LIFECYCLE_LABELS[lifecycleKey]),
        csvEscape(ownerByContact.get(c.id as string) ?? ""),
        csvEscape(String(c.created_at ?? "")),
      ].join(",")
    );
  }

  const filenameParts = ["contacts"];
  if (lifecycle && lifecycle !== "lead") filenameParts.push(lifecycle);

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameParts.join("-")}.csv"`,
    },
  });
}
