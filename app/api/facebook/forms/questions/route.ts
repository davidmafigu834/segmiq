import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { fetchFacebookFormQuestions } from "@/lib/facebook/form-questions";
import {
  defaultRulesFromQuestions,
  mergeRulesWithQuestions,
  parseFacebookQualificationRules,
} from "@/lib/facebook/qualification";
import { fbLog } from "@/lib/facebook/log";

/** Sync Meta Instant Form questions onto the client and merge into qualification rules. */
export async function POST(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: { clientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientId = body.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select(
      "id, fb_access_token, fb_form_id, fb_qualification_rules, fb_qualification_enabled"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (cErr || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const token = client.fb_access_token as string | null;
  const formId = client.fb_form_id as string | null;
  if (!token || !formId) {
    return NextResponse.json(
      { error: "Connect a Facebook Page and Lead Form first" },
      { status: 400 }
    );
  }

  const fetched = await fetchFacebookFormQuestions({
    formId,
    accessToken: token,
    clientId,
  });

  if (!fetched.ok) {
    return NextResponse.json(
      { error: fetched.error, tokenExpired: fetched.tokenExpired },
      { status: fetched.tokenExpired ? 401 : 502 }
    );
  }

  const existingRules = client.fb_qualification_rules
    ? parseFacebookQualificationRules(client.fb_qualification_rules)
    : null;
  const mergedRules = existingRules
    ? mergeRulesWithQuestions(existingRules, fetched.questions)
    : defaultRulesFromQuestions(fetched.questions);

  const { error: uErr } = await supabase
    .from("clients")
    .update({
      fb_form_questions: fetched.questions,
      fb_qualification_rules: mergedRules,
      ...(fetched.formName ? { fb_form_name: fetched.formName } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  fbLog("fb.form.questions_synced", {
    clientId,
    formId,
    questionCount: fetched.questions.length,
  });

  return NextResponse.json({
    ok: true,
    questions: fetched.questions,
    rules: mergedRules,
    enabled: Boolean(client.fb_qualification_enabled),
    formName: fetched.formName ?? null,
  });
}

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
      "fb_form_questions, fb_qualification_rules, fb_qualification_enabled, fb_form_id, fb_form_name"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    questions: client.fb_form_questions ?? [],
    rules: client.fb_qualification_rules
      ? parseFacebookQualificationRules(client.fb_qualification_rules)
      : null,
    enabled: Boolean(client.fb_qualification_enabled),
    formId: client.fb_form_id ?? null,
    formName: client.fb_form_name ?? null,
  });
}
