import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  name: z.string().min(2).max(120),
  businessName: z.string().min(2).max(200),
  industry: z.string().min(2).max(120),
  phone: z.string().min(8).max(30),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function randomChars(n: number): string {
  return Math.random().toString(36).substring(2, 2 + n);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const firstField = Object.keys(flat.fieldErrors)[0];
    const firstMsg = firstField
      ? (flat.fieldErrors as Record<string, string[]>)[firstField]?.[0]
      : flat.formErrors[0];
    return NextResponse.json(
      { error: firstMsg ?? "Invalid input", details: flat },
      { status: 400 }
    );
  }

  const { name, businessName, industry, phone, email, password } = parsed.data;
  const supabase = createAdminClient();

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists.", field: "email" },
      { status: 409 }
    );
  }

  let slug = slugify(businessName);
  if (!slug) slug = randomChars(8);

  const { data: slugTaken } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (slugTaken) {
    slug = `${slug}-${randomChars(4)}`;
  }

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .insert({
      name: businessName.trim(),
      industry: industry.trim(),
      slug,
      plan: "starter",
      is_active: true,
      response_time_limit_hours: 24,
    })
    .select("id")
    .single();

  if (clientErr || !client) {
    console.error("[cloud/signup] client insert:", clientErr);
    return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }

  await supabase.from("client_profiles").insert({
    client_id: client.id as string,
    slug,
    is_published: false,
  });

  const hashedPw = await hashPassword(password);

  const { error: userErr } = await supabase.from("users").insert({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPw,
    role: "CLIENT_MANAGER",
    client_id: client.id as string,
    phone: phone.trim(),
    is_active: true,
  });

  if (userErr) {
    console.error("[cloud/signup] user insert:", userErr);
    await supabase.from("clients").delete().eq("id", client.id as string);
    return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true, email: email.toLowerCase().trim() });
}
