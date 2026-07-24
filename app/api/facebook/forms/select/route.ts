import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAgencyAdmin } from "@/lib/auth/permissions";
import { fbLog } from "@/lib/facebook/log";
import { fetchFacebookFormQuestions } from "@/lib/facebook/form-questions";
import { defaultRulesFromQuestions } from "@/lib/facebook/qualification";

export async function POST(req: Request) {
  const check = await requireAgencyAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: { clientId?: string; formId?: string; formName?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { clientId, formId, formName } = body;
  if (!clientId || !formId) {
    return NextResponse.json({ error: "clientId and formId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: current } = await supabase
    .from("clients")
    .select("fb_page_id, fb_access_token, fb_form_id")
    .eq("id", clientId)
    .maybeSingle();

  const pageId = (current as { fb_page_id?: string | null } | null)?.fb_page_id;
  if (pageId) {
    const { data: conflict } = await supabase
      .from("clients")
      .select("id, name")
      .eq("fb_page_id", pageId)
      .eq("fb_form_id", formId)
      .neq("id", clientId)
      .limit(1)
      .maybeSingle();

    if (conflict) {
      const otherName = (conflict as { name?: string }).name ?? "another client";
      return NextResponse.json(
        {
          error: `This Page + Lead Form is already connected to "${otherName}". Disconnect Facebook there first, or choose a different form.`,
        },
        { status: 409 }
      );
    }
  }

  const previousFormId = (current as { fb_form_id?: string | null } | null)?.fb_form_id ?? null;
  const token = (current as { fb_access_token?: string | null } | null)?.fb_access_token ?? null;

  const update: Record<string, unknown> = {
    fb_form_id: formId,
    fb_form_name: formName ?? null,
    updated_at: new Date().toISOString(),
  };

  // Reset cached questions/rules when switching forms; sync fresh questions when possible.
  if (previousFormId !== formId) {
    update.fb_form_questions = null;
    update.fb_qualification_rules = null;
    update.fb_qualification_enabled = false;
  }

  if (token) {
    const fetched = await fetchFacebookFormQuestions({
      formId,
      accessToken: token,
      clientId,
    });
    if (fetched.ok) {
      update.fb_form_questions = fetched.questions;
      update.fb_qualification_rules = defaultRulesFromQuestions(fetched.questions);
      if (fetched.formName) update.fb_form_name = fetched.formName;
      fbLog("fb.form.questions_synced", {
        clientId,
        formId,
        questionCount: fetched.questions.length,
      });
    }
  }

  const { error } = await supabase.from("clients").update(update).eq("id", clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  fbLog("fb.form.selected", { clientId, formId });
  return NextResponse.json({ ok: true });
}
