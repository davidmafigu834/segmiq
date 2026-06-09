import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { firstName } from "@/lib/messaging/whatsapp-vars";

const COACHING_MESSAGES: Record<
  number,
  { dayMessage: string; dayGoal: string }
> = {
  1: {
    dayMessage:
      "Today is all about getting comfortable. Open each lead, read the notes, and reply to your first conversation.",
    dayGoal: "respond to every lead assigned to you",
  },
  3: {
    dayMessage:
      "You're finding your rhythm. The fastest reps log every call right after it happens and send the portfolio early.",
    dayGoal: "log a call note within 5 minutes of each conversation",
  },
  7: {
    dayMessage:
      "One week in. Now we focus on follow-through — most deals are won on the second or third contact.",
    dayGoal: "set a follow-up date on every open lead",
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

  await sendWhatsApp({
    to: user.phone as string,
    template: "SALESPERSON_ONBOARDING",
    variables: {
      "1": firstName(user.name as string),
      "2": coaching.dayMessage,
      "3": coaching.dayGoal,
    },
    fallbackBody: `Welcome to the team, ${firstName(user.name as string)}. ${coaching.dayMessage} Your goal for today: ${coaching.dayGoal}.`,
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
