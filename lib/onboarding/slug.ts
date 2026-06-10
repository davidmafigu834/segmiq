export function suggestSlugFromName(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return s.length > 0 ? s : "client";
}

export function shellSlug(clientId: string): string {
  const short = clientId.replace(/-/g, "").slice(0, 12);
  return `pending-${short}`;
}
