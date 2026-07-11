export type ClientCertification = {
  name: string;
  issuing_body: string;
  issued_year: string;
  certificate_url: string;
};

export type ClientTeamMember = {
  name: string;
  role: string;
  bio: string;
  photo_url: string;
};

export type ClientCapabilityStat = {
  label: string;
  value: string;
  stated_as_of: string;
};

export type ClientCapabilityProfile = {
  capability_tagline: string | null;
  years_in_operation: number | null;
  industries_served: string[];
  certifications: ClientCertification[];
  team_members: ClientTeamMember[];
  capability_stats: ClientCapabilityStat[];
};

export const CLIENT_CAPABILITY_COLUMNS = [
  "capability_tagline",
  "years_in_operation",
  "industries_served",
  "certifications",
  "team_members",
  "capability_stats",
] as const;

export function isMissingCapabilityColumnError(message: string | undefined): boolean {
  if (!message) return false;
  return CLIENT_CAPABILITY_COLUMNS.some((col) => message.includes(col));
}

function parseCertifications(raw: unknown): ClientCertification[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const issuing_body = typeof row.issuing_body === "string" ? row.issuing_body.trim() : "";
      const issued_year = typeof row.issued_year === "string" ? row.issued_year.trim() : "";
      const certificate_url =
        typeof row.certificate_url === "string" ? row.certificate_url.trim() : "";
      if (!name && !issuing_body && !issued_year && !certificate_url) return null;
      return { name, issuing_body, issued_year, certificate_url };
    })
    .filter((row): row is ClientCertification => row !== null);
}

function parseTeamMembers(raw: unknown): ClientTeamMember[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const role = typeof row.role === "string" ? row.role.trim() : "";
      const bio = typeof row.bio === "string" ? row.bio.trim() : "";
      const photo_url = typeof row.photo_url === "string" ? row.photo_url.trim() : "";
      if (!name && !role && !bio && !photo_url) return null;
      return { name, role, bio, photo_url };
    })
    .filter((row): row is ClientTeamMember => row !== null);
}

function parseCapabilityStats(raw: unknown): ClientCapabilityStat[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const value = typeof row.value === "string" ? row.value.trim() : "";
      const stated_as_of = typeof row.stated_as_of === "string" ? row.stated_as_of.trim() : "";
      if (!label || !value || !stated_as_of) return null;
      return { label, value, stated_as_of };
    })
    .filter((row): row is ClientCapabilityStat => row !== null);
}

export function parseClientCapabilityProfile(raw: Record<string, unknown>): ClientCapabilityProfile {
  const tagline =
    typeof raw.capability_tagline === "string" ? raw.capability_tagline.trim() : "";
  const yearsRaw = raw.years_in_operation;
  const years =
    typeof yearsRaw === "number" && Number.isFinite(yearsRaw) && yearsRaw > 0
      ? Math.floor(yearsRaw)
      : null;
  const industries = Array.isArray(raw.industries_served)
    ? raw.industries_served
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

  return {
    capability_tagline: tagline || null,
    years_in_operation: years,
    industries_served: industries,
    certifications: parseCertifications(raw.certifications),
    team_members: parseTeamMembers(raw.team_members),
    capability_stats: parseCapabilityStats(raw.capability_stats),
  };
}

export function hasCapabilityContent(profile: ClientCapabilityProfile): boolean {
  if (profile.capability_tagline) return true;
  if (profile.years_in_operation) return true;
  if (profile.industries_served.length > 0) return true;
  if (profile.certifications.some((c) => c.name || c.issuing_body || c.issued_year)) return true;
  if (profile.team_members.some((m) => m.name)) return true;
  if (profile.capability_stats.length > 0) return true;
  return false;
}

export function shouldShowCapabilitySection(
  includeCapabilitySection: boolean,
  profile: ClientCapabilityProfile
): boolean {
  return includeCapabilitySection && hasCapabilityContent(profile);
}

export function formatCapabilityStatedAsOf(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function getInitialsFromName(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
