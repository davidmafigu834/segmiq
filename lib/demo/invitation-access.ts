export function invitationAccess(
  row: { expires_at: string; revoked_at: string | null } | null,
  now = Date.now()
): "valid" | "missing" | "expired" | "revoked" {
  if (!row) return "missing";
  if (row.revoked_at) return "revoked";
  const expires = Date.parse(row.expires_at);
  if (!Number.isFinite(expires) || expires <= now) return "expired";
  return "valid";
}
