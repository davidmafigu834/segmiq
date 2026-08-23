import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { canManageCatalog } from "@/lib/quotations/quote-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObject, getPublicUrl, putObject } from "@/lib/storage/r2";
import { ensureQuotationSettings } from "@/lib/quotations/quote-number";
import {
  AUTHORISED_SIGNATURE_MAX_BYTES,
  generateAuthorisedSignatureKey,
  isPngSignature,
} from "@/lib/quotations/authorised-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can save the authorised signature" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Signature image is required" }, { status: 400 });
  }
  if (file.size > AUTHORISED_SIGNATURE_MAX_BYTES) {
    return NextResponse.json({ error: "Signature image is too large." }, { status: 400 });
  }
  if (!isPngSignature(file.type)) {
    return NextResponse.json({ error: "Signature must be a PNG drawing." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const settings = await ensureQuotationSettings(supabase, params.clientId);
  const previousKey = (settings.authorised_signature_storage_key as string | null)?.trim() || null;

  try {
    const key = generateAuthorisedSignatureKey(params.clientId);
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(key, buffer, "image/png");
    const publicUrl = getPublicUrl(key);
    const { data, error } = await supabase
      .from("quotation_settings")
      .update({
        authorised_signature_url: publicUrl,
        authorised_signature_storage_key: key,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", params.clientId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (previousKey && previousKey !== key) {
      await deleteObject(previousKey).catch(() => undefined);
    }
    return NextResponse.json({ settings: data, publicUrl, key });
  } catch (err) {
    console.error("[authorised signature upload]", err);
    return NextResponse.json({ error: "Could not save the signature. Check file storage settings." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role ?? "", session.clientId ?? null, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageCatalog(session.role)) {
    return NextResponse.json({ error: "Only managers can remove the authorised signature" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const settings = await ensureQuotationSettings(supabase, params.clientId);
  const previousKey = (settings.authorised_signature_storage_key as string | null)?.trim() || null;
  const { data, error } = await supabase
    .from("quotation_settings")
    .update({
      authorised_signature_url: null,
      authorised_signature_storage_key: null,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", params.clientId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (previousKey) await deleteObject(previousKey).catch(() => undefined);
  return NextResponse.json({ settings: data });
}
