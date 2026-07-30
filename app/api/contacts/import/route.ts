import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";

export const dynamic = "force-dynamic";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] ?? "";
      });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v));
}

export async function POST(req: Request) {
  const g = await requireSession();
  if ("error" in g) return g.error;

  const { session } = g;
  if (session.role !== "SUPER_ADMIN" && session.role !== "CLIENT_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const clientId =
    session.role === "SUPER_ADMIN"
      ? (formData.get("clientId") as string | null)
      : session.clientId;

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  if (!canAccessClient(session.role, session.clientId, clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("dial_code")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const rows = parseCsv(await file.text());
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }

  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("phone")
    .eq("client_id", clientId);
  const existingPhones = new Set((existingContacts ?? []).map((c) => c.phone as string));

  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = (row["name"] ?? "").trim() || null;
    const phoneRaw = (row["phone"] ?? "").trim();
    if (!phoneRaw) {
      errors.push(`Row missing phone${name ? ` (${name})` : ""}`);
      continue;
    }

    const wa = normalizePhoneForWhatsApp(phoneRaw, (client.dial_code as string) || "263");
    if (!wa) {
      errors.push(`Invalid phone "${phoneRaw}"${name ? ` for ${name}` : ""}`);
      continue;
    }
    const phone = "+" + wa;

    if (existingPhones.has(phone)) {
      errors.push(`Duplicate phone ${phone}${name ? ` (${name})` : ""}`);
      continue;
    }

    const email = (row["email"] ?? "").trim() || null;
    const source = (row["source"] ?? "").trim() || "Import";
    const notes = (row["notes"] ?? "").trim() || null;

    const { error } = await supabase.from("contacts").insert({
      client_id: clientId,
      name,
      phone,
      email,
      source,
      lead_origin: "client",
      lifecycle: "cold",
      notes,
    });

    if (error) {
      errors.push(`Could not import ${phone}: ${error.message}`);
    } else {
      existingPhones.add(phone);
      imported++;
    }
  }

  return NextResponse.json({
    imported,
    skipped: errors.length,
    errors,
  });
}
