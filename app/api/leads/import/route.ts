import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api-guards";
import { normalizeToE164 } from "@/lib/phone-validate";
import { sourceFromString } from "@/lib/lead-helpers";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";

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
  if (session.role !== "AGENCY_ADMIN" && session.role !== "CLIENT_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const clientId = formData.get("clientId") as string | null;

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  if (session.role === "CLIENT_MANAGER" && session.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, round_robin_index")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const csvText = await file.text();
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }

  const { data: salespeople } = await supabase
    .from("users")
    .select("id, name, email, round_robin_order")
    .eq("client_id", clientId)
    .eq("role", "SALESPERSON")
    .eq("is_active", true)
    .order("round_robin_order", { ascending: true });

  const activeSalespeople = salespeople ?? [];

  const { data: existingLeads } = await supabase
    .from("leads")
    .select("phone")
    .eq("client_id", clientId);
  const existingPhones = new Set((existingLeads ?? []).map((l) => l.phone as string));

  let rrIndex = Number((client as { round_robin_index?: number }).round_robin_index ?? 0);
  let imported = 0;
  const skipped: string[] = [];

  for (const row of rows) {
    const name = (row["name"] ?? "").trim();
    const phoneRaw = (row["phone"] ?? "").trim();

    if (!name) {
      skipped.push(`Row missing name: ${JSON.stringify(row)}`);
      continue;
    }
    if (!phoneRaw) {
      skipped.push(`Row missing phone (name: ${name})`);
      continue;
    }

    const phone = normalizeToE164(phoneRaw);
    if (!phone) {
      skipped.push(`Invalid phone "${phoneRaw}" for ${name}`);
      continue;
    }

    if (existingPhones.has(phone)) {
      skipped.push(`Duplicate phone ${phone} (${name})`);
      continue;
    }

    const sourceRaw = (row["source"] ?? "MANUAL").trim().toUpperCase();
    const source = sourceFromString(sourceRaw);

    const email = (row["email"] ?? "").trim() || null;
    const budget = row["budget"] ? Number(row["budget"]) : null;
    const notes = (row["notes"] ?? "").trim() || null;

    let assignedToId: string | null = null;
    const assignedEmail = (row["assigned_to_email"] ?? "").trim().toLowerCase();
    if (assignedEmail) {
      const match = activeSalespeople.find(
        (sp) => (sp.email as string).toLowerCase() === assignedEmail
      );
      if (match) {
        assignedToId = match.id as string;
      }
    }

    if (!assignedToId && activeSalespeople.length > 0) {
      assignedToId =
        activeSalespeople[rrIndex % activeSalespeople.length]?.id ?? null;
      rrIndex++;
    }

    const magicToken = randomUUID();
    const magicTokenExpiresAt = addDays(new Date(), 30).toISOString();

    const { error } = await supabase.from("leads").insert({
      client_id: clientId,
      name,
      phone,
      email,
      source,
      status: "NEW",
      deal_value: budget,
      notes,
      assigned_to_id: assignedToId,
      magic_token: magicToken,
      magic_token_expires_at: magicTokenExpiresAt,
    });

    if (error) {
      skipped.push(`DB error for ${name}: ${error.message}`);
    } else {
      existingPhones.add(phone);
      imported++;
    }
  }

  if (activeSalespeople.length > 0 && rrIndex > 0) {
    await supabase
      .from("clients")
      .update({ round_robin_index: rrIndex % activeSalespeople.length })
      .eq("id", clientId);
  }

  return NextResponse.json({
    imported,
    skipped: skipped.length,
    errors: skipped,
  });
}
