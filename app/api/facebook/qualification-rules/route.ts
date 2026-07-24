import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import {
  parseFacebookQualificationRules,
  type FbQualificationRules,
} from "@/lib/facebook/qualification";
import { parseStoredFormQuestions } from "@/lib/facebook/form-questions";
import { fbLog } from "@/lib/facebook/log";

export async function GET(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const clientId = new URL(req.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select(
      "fb_form_id, fb_form_name, fb_form_questions, fb_qualification_enabled, fb_qualification_rules"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    formId: client.fb_form_id ?? null,
    formName: client.fb_form_name ?? null,
    questions: parseStoredFormQuestions(client.fb_form_questions),
    enabled: Boolean(client.fb_qualification_enabled),
    rules: client.fb_qualification_rules
      ? parseFacebookQualificationRules(client.fb_qualification_rules)
      : null,
  });
}

export async function POST(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: {
    clientId?: string;
    enabled?: boolean;
    rules?: FbQualificationRules;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { clientId, enabled, rules } = body;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (rules == null && typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled or rules required" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof enabled === "boolean") {
    update.fb_qualification_enabled = enabled;
  }
  if (rules != null) {
    update.fb_qualification_rules = parseFacebookQualificationRules(rules);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("clients").update(update).eq("id", clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  fbLog("fb.qualification.rules_saved", {
    clientId,
    enabled: typeof enabled === "boolean" ? enabled : undefined,
    ruleCount: rules ? parseFacebookQualificationRules(rules).rules.length : undefined,
  });

  return NextResponse.json({ ok: true });
}
