import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/password";
import { normalizeToE164 } from "@/lib/phone-validate";
import { seedPredefinedSegments } from "@/lib/audience-segments";
import { getDefaultResponseHoursForNewClients } from "@/lib/agency-settings";
import { sendEmail } from "@/lib/email/resend";
import { inviteSalespersonEmail } from "@/lib/email/templates/invite-salesperson";
import type { OnboardingCountryCode, OnboardingProgress } from "@/lib/onboarding/constants";
import { dialCodeForCountry } from "@/lib/onboarding/constants";
import type { OnboardingTokenRow } from "@/lib/onboarding/tokens";
import { isClientSlugAvailable } from "@/lib/clients/slug";

export const ONBOARDING_ALREADY_COMPLETED = "This onboarding link has already been completed";

export type ActivateClientInput = {
  clientId: string;
  mode: "team" | "solo";
  ownerEmail: string;
  password: string;
  progress: OnboardingProgress;
  tokenRow?: OnboardingTokenRow;
};

export type FinishOnboardingInput = ActivateClientInput & {
  tokenRow: OnboardingTokenRow;
};

export type FinishOnboardingResult =
  | {
      ok: true;
      ownerUserId: string;
      ownerRole: "CLIENT_MANAGER" | "SALESPERSON";
      teamInviteResults: Array<{ email: string; emailSent: boolean }>;
    }
  | { ok: false; error: string; status: number };

type IsoCountry = string;

type PendingTeamInvite = {
  memberEmail: string;
  memberName: string;
  temporaryPassword: string;
};

function countryToIso(country: OnboardingCountryCode): IsoCountry {
  return country;
}

export async function activateClientFromProgress(input: ActivateClientInput): Promise<FinishOnboardingResult> {
  const { tokenRow, clientId, mode, ownerEmail, password, progress } = input;
  const company = progress.company;
  const account = progress.account;
  const branding = progress.branding;
  const team = progress.team ?? [];

  if (!company?.name?.trim() || !company.industry?.trim() || !company.slug?.trim() || !company.country) {
    return { ok: false, error: "Company details are incomplete", status: 400 };
  }
  if (!account?.ownerName?.trim()) {
    return { ok: false, error: "Owner name is required", status: 400 };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters", status: 400 };
  }

  const slug = company.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: "Invalid slug", status: 400 };
  }

  const dialCode = dialCodeForCountry(company.country);
  const defaultCountry = company.country === "ZW" ? "ZW" : company.country === "ZA" ? "ZA" : company.country === "KE" ? "KE" : "ZM";
  const ownerPhoneNorm = account.phone?.trim()
    ? normalizeToE164(account.phone.trim(), defaultCountry)
    : null;

  if (mode === "solo" && !ownerPhoneNorm) {
    return {
      ok: false,
      error: "WhatsApp number is required for solo accounts. Use international format like +263 77 123 4567.",
      status: 400,
    };
  }
  if (mode === "team" && account.phone?.trim() && !ownerPhoneNorm) {
    return {
      ok: false,
      error: "Manager phone looks invalid. Use international format like +263 77 123 4567.",
      status: 400,
    };
  }

  const filledTeam = team.filter((m) => m.name?.trim() || m.email?.trim() || m.phone?.trim());

  if (mode === "team") {
    for (const member of filledTeam) {
      if (!member.name?.trim() || !member.email?.trim() || !member.phone?.trim()) {
        return { ok: false, error: "Each salesperson needs a name, email, and phone", status: 400 };
      }
      if (!normalizeToE164(member.phone.trim(), defaultCountry)) {
        return {
          ok: false,
          error: `Invalid phone for ${member.email}. Use international format.`,
          status: 400,
        };
      }
    }
  }

  const supabase = createAdminClient();

  const slugAvailable = await isClientSlugAvailable(supabase, slug, clientId);
  if (!slugAvailable) {
    return { ok: false, error: "Slug already in use", status: 400 };
  }

  const email = ownerEmail.toLowerCase().trim();
  const { data: emailDupe } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (emailDupe) {
    return { ok: false, error: "Owner email already registered", status: 400 };
  }

  for (const member of filledTeam) {
    const memberEmail = member.email.toLowerCase().trim();
    if (memberEmail === email) {
      return { ok: false, error: "Team member email cannot match the owner email", status: 400 };
    }
    const { data: dupe } = await supabase.from("users").select("id").eq("email", memberEmail).maybeSingle();
    if (dupe) {
      return { ok: false, error: `Email already registered: ${memberEmail}`, status: 400 };
    }
  }

  const createdUserIds: string[] = [];
  const teamInviteResults: Array<{ email: string; emailSent: boolean; temporaryPassword?: string }> = [];
  let createdForm = false;
  let createdProfile = false;

  const { data: shellSnapshot } = await supabase
    .from("clients")
    .select("name, industry, slug")
    .eq("id", clientId)
    .maybeSingle();

  const ownerRole: "CLIENT_MANAGER" | "SALESPERSON" = mode === "solo" ? "SALESPERSON" : "CLIENT_MANAGER";
  const passwordHash = await hashPassword(password);

  let clientActivated = false;
  let tokenClaimed = false;

  try {
    if (tokenRow) {
      const { data: claimedToken, error: claimErr } = await supabase
        .from("client_onboarding_tokens")
        .update({ used: true })
        .eq("id", tokenRow.id)
        .eq("used", false)
        .select("id")
        .maybeSingle();

      if (claimErr) throw new Error(claimErr.message);
      if (!claimedToken) {
        return { ok: false, error: ONBOARDING_ALREADY_COMPLETED, status: 400 };
      }
      tokenClaimed = true;
    }

    const defaultHours = await getDefaultResponseHoursForNewClients();

    const { data: activatedClient, error: clientErr } = await supabase
      .from("clients")
      .update({
        name: company.name.trim(),
        industry: company.industry.trim(),
        slug,
        country: countryToIso(company.country),
        website: company.website?.trim() || null,
        logo_url: branding?.logoUrl ?? null,
        dial_code: dialCode,
        setup_status: "active",
        is_active: true,
        onboarding_progress: {},
        response_time_limit_hours: defaultHours,
        business_type: company.businessType === "real_estate" ? "real_estate" : "trades",
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId)
      .eq("setup_status", "pending")
      .select("id")
      .maybeSingle();

    if (clientErr) throw new Error(clientErr.message);
    if (!activatedClient) {
      return { ok: false, error: ONBOARDING_ALREADY_COMPLETED, status: 400 };
    }
    clientActivated = true;

    const { data: ownerUser, error: ownerErr } = await supabase
      .from("users")
      .insert({
        name: account.ownerName.trim(),
        email,
        phone: ownerPhoneNorm,
        password: passwordHash,
        role: ownerRole,
        client_id: clientId,
        is_active: true,
        round_robin_order: mode === "solo" ? 0 : 0,
      })
      .select("id")
      .single();

    if (ownerErr || !ownerUser) throw new Error(ownerErr?.message ?? "Failed to create owner account");
    createdUserIds.push(ownerUser.id as string);

    const { data: existingForm } = await supabase
      .from("form_schemas")
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (!existingForm) {
      const { error: formErr } = await supabase.from("form_schemas").insert({
        client_id: clientId,
        form_title: "Contact us",
        fields: [],
      });
      if (formErr) throw new Error(formErr.message);
      createdForm = true;
    }

    const { data: existingProfile } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (!existingProfile) {
      const { error: profileErr } = await supabase.from("client_profiles").insert({
        client_id: clientId,
        slug,
        is_published: false,
      });
      if (profileErr) throw new Error(profileErr.message);
      createdProfile = true;
    } else {
      await supabase.from("client_profiles").update({ slug }).eq("client_id", clientId);
    }

    const pendingTeamInvites: PendingTeamInvite[] = [];

    if (mode === "team") {
      let rr = 0;
      const { data: maxRow } = await supabase
        .from("users")
        .select("round_robin_order")
        .eq("client_id", clientId)
        .eq("role", "SALESPERSON")
        .order("round_robin_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      rr = Number((maxRow as { round_robin_order?: number } | null)?.round_robin_order ?? -1) + 1;

      for (const member of filledTeam) {
        const memberEmail = member.email.toLowerCase().trim();
        const phoneNorm = normalizeToE164(member.phone.trim(), defaultCountry)!;
        const tempPass = randomBytes(12).toString("base64url").slice(0, 16);
        const memberHash = await hashPassword(tempPass);

        const { data: memberUser, error: memberErr } = await supabase
          .from("users")
          .insert({
            name: member.name.trim(),
            email: memberEmail,
            phone: phoneNorm,
            password: memberHash,
            role: "SALESPERSON",
            client_id: clientId,
            is_active: true,
            round_robin_order: rr++,
          })
          .select("id")
          .single();

        if (memberErr || !memberUser) throw new Error(memberErr?.message ?? "Failed to create salesperson");

        createdUserIds.push(memberUser.id as string);
        pendingTeamInvites.push({
          memberEmail,
          memberName: member.name.trim(),
          temporaryPassword: tempPass,
        });
      }
    }

    const loginUrl = `${process.env.NEXTAUTH_URL}/login`;
    for (const invite of pendingTeamInvites) {
      const { subject, html } = inviteSalespersonEmail({
        inviteeName: invite.memberName,
        invitedByName: account.ownerName.trim(),
        clientName: company.name.trim(),
        role: "SALESPERSON",
        email: invite.memberEmail,
        temporaryPassword: invite.temporaryPassword,
        loginUrl,
      });
      const emailResult = await sendEmail({ to: invite.memberEmail, subject, html });
      teamInviteResults.push({
        email: invite.memberEmail,
        emailSent: emailResult.success,
        temporaryPassword: invite.temporaryPassword,
      });
    }

    seedPredefinedSegments(clientId).catch((err) =>
      console.error("[finishOnboarding] seedPredefinedSegments failed:", err)
    );

    return {
      ok: true,
      ownerUserId: ownerUser.id as string,
      ownerRole,
      teamInviteResults,
    };
  } catch (err) {
    console.error("[finishOnboarding] rollback:", err);
    if (clientActivated) {
      if (createdUserIds.length > 0) {
        await supabase.from("users").delete().in("id", createdUserIds);
      }
      if (createdForm) {
        await supabase.from("form_schemas").delete().eq("client_id", clientId);
      }
      if (createdProfile) {
        await supabase.from("client_profiles").delete().eq("client_id", clientId);
      }
      const snap = shellSnapshot as { name?: string; industry?: string; slug?: string } | null;
      await supabase
        .from("clients")
        .update({
          name: snap?.name ?? "Pending setup",
          industry: snap?.industry ?? "Pending",
          slug: snap?.slug ?? `pending-${clientId.replace(/-/g, "").slice(0, 12)}`,
          country: null,
          website: null,
          logo_url: null,
          dial_code: null,
          setup_status: "pending",
          is_active: false,
          onboarding_progress: progress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId);
    }
    if (tokenClaimed && tokenRow) {
      await supabase
        .from("client_onboarding_tokens")
        .update({ used: false })
        .eq("id", tokenRow.id);
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to complete onboarding",
      status: 500,
    };
  }
}

export async function finishOnboarding(input: FinishOnboardingInput): Promise<FinishOnboardingResult> {
  return activateClientFromProgress(input);
}
