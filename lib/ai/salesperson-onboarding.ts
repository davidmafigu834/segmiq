import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/messaging/provider";

const COACHING_MESSAGES: Record<
  number,
  { getMessage: (name: string, clientName: string, loginUrl: string) => string }
> = {
  1: {
    getMessage: (name, clientName, loginUrl) =>
      `Welcome to ${clientName}, ${name}!

You have been added to Leadstaq — the platform that keeps all your leads organised so nothing falls through the cracks.

Here is what to do first:

Log in at ${loginUrl} using the email and password you received.

Go to My Leads to see any leads already assigned to you.

When you speak to a prospect, always log the call — even a missed call counts.

Use the Send panel on any lead to share the company portfolio in one tap.

Your manager can see your activity. Make it count.

Good luck today.`,
  },
  3: {
    getMessage: (name, clientName) =>
      `Hi ${name}, it is day 3 at ${clientName}.

A few things that the best salespeople on this platform do differently:

They log every call — even no answers. This keeps the timeline complete so nothing is forgotten.

They send the portfolio link early. Prospects who see the company's completed projects convert at a higher rate. One tap from the Send panel.

They set a follow-up date on every call. If you do not schedule the next step the lead goes cold.

Check your lead scores in the app. The higher the score the hotter the lead — prioritise those first.

Keep going. The numbers will follow.`,
  },
  7: {
    getMessage: (name, clientName) =>
      `Hi ${name}, one week in at ${clientName}.

By now you should have a feel for your leads. A few things to check:

Are any leads going stale? If a lead has no activity for 7 days the app flags it in red. Use the re-engagement message to bring them back.

Are you using the Send panel? You can send pricing packages, projects, testimonials — all from inside the lead. Do not hunt for documents.

Follow-up dates — every lead should have one. If a lead has no follow-up date set it now.

Your timeline is your proof of work. Every call, every document sent, every update is recorded. Your manager sees it all.

You are building a pipeline. Keep it moving.`,
  },
};

export async function sendOnboardingCoaching(
  userId: string,
  dayNumber: 1 | 3 | 7
): Promise<void> {
  const supabase = createAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("id, name, phone, client_id")
    .eq("id", userId)
    .single();

  if (!user || !(user.phone as string | null)) return;

  const coaching = COACHING_MESSAGES[dayNumber];
  if (!coaching) return;

  let clientName = "your company";
  if (user.client_id) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("name")
      .eq("id", user.client_id as string)
      .maybeSingle();
    if (clientRow?.name) clientName = clientRow.name as string;
  }

  const loginUrl = `${process.env.NEXTAUTH_URL ?? ""}/login`;
  const message = coaching.getMessage(user.name as string, clientName, loginUrl);

  await sendWhatsApp({
    to: user.phone as string,
    template: "SALESPERSON_ONBOARDING",
    variables: {
      "1": user.name as string,
      "2": message,
    },
    fallbackBody: message,
    context: {
      clientId: (user.client_id as string | null) ?? undefined,
      notificationType: "SALESPERSON_ONBOARDING",
    },
  });
}

export async function runOnboardingCronJobs(): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date();

  for (const day of [1, 3, 7] as const) {
    const targetDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
    const windowStart = new Date(targetDate.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(targetDate.getTime() + 60 * 60 * 1000);

    const { data: newSalespeople } = await supabase
      .from("users")
      .select("id, name, phone")
      .eq("role", "SALESPERSON")
      .eq("is_active", true)
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString());

    for (const sp of newSalespeople ?? []) {
      try {
        await sendOnboardingCoaching(sp.id as string, day);
      } catch (err) {
        console.error(
          `[salesperson-onboarding] Day ${day} failed for ${sp.id as string}:`,
          err
        );
      }
    }
  }
}
