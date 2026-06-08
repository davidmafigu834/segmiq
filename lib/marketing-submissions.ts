import { createAdminClient } from "@/lib/supabase/admin";

export type SubmissionType = "demo" | "contact" | "partner" | "career";
export type SubmissionStatus = "new" | "contacted" | "converted" | "archived";

export type SubmissionInput = {
  type: SubmissionType;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  market?: string;
  industry?: string;
  teamSize?: string;
  leadVolume?: string;
  role?: string;
  message?: string;
  source?: string;
};

export type MarketingSubmission = {
  id: string;
  type: SubmissionType;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  market: string | null;
  industry: string | null;
  team_size: string | null;
  lead_volume: string | null;
  role: string | null;
  message: string | null;
  source: string | null;
  status: SubmissionStatus;
  created_at: string;
};

export async function createSubmission(input: SubmissionInput) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("marketing_submissions").insert({
    type: input.type,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    company: input.company ?? null,
    market: input.market ?? null,
    industry: input.industry ?? null,
    team_size: input.teamSize ?? null,
    lead_volume: input.leadVolume ?? null,
    role: input.role ?? null,
    message: input.message ?? null,
    source: input.source ?? null,
  });
  if (error) throw error;
}

export async function listSubmissions(opts?: { type?: SubmissionType; status?: SubmissionStatus }) {
  const supabase = createAdminClient();
  let q = supabase.from("marketing_submissions").select("*").order("created_at", { ascending: false });
  if (opts?.type) q = q.eq("type", opts.type);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MarketingSubmission[];
}

export async function updateSubmissionStatus(id: string, status: SubmissionStatus) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("marketing_submissions").update({ status }).eq("id", id);
  if (error) throw error;
}
