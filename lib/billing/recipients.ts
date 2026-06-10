import { createAdminClient } from "@/lib/supabase/admin";
import { isClientSoloMode } from "@/lib/billing/client-access";

export type BillingContact = {
  id: string;
  email: string | null;
  phone: string | null;
};

/**
 * Billing notification recipients: active CLIENT_MANAGER(s) on team clients,
 * or the active salesperson owner(s) on solo clients (typically one).
 */
export async function getClientBillingContacts(clientId: string): Promise<BillingContact[]> {
  const supabase = createAdminClient();
  const solo = await isClientSoloMode(clientId);
  const role = solo ? "SALESPERSON" : "CLIENT_MANAGER";

  const { data } = await supabase
    .from("users")
    .select("id, email, phone, created_at")
    .eq("client_id", clientId)
    .eq("role", role)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const rows = data ?? [];

  if (solo) {
    if (rows.length > 1) {
      console.warn(
        `[getClientBillingContacts] solo client ${clientId} has ${rows.length} active salespeople; using earliest-created as owner`
      );
    }
    const owner = rows[0];
    return owner
      ? [
          {
            id: owner.id as string,
            email: (owner.email as string | null) ?? null,
            phone: (owner.phone as string | null) ?? null,
          },
        ]
      : [];
  }

  return rows.map((u) => ({
    id: u.id as string,
    email: (u.email as string | null) ?? null,
    phone: (u.phone as string | null) ?? null,
  }));
}

/**
 * Email addresses for billing notifications — managers on team clients,
 * owner salesperson on solo clients.
 */
export async function getClientNotificationEmails(clientId: string): Promise<string[]> {
  const contacts = await getClientBillingContacts(clientId);
  return contacts.map((c) => c.email?.trim()).filter((e): e is string => Boolean(e));
}
