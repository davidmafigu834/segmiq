export function buildProjectShareUrl(
  origin: string,
  projectId: string,
  profileSlug?: string | null
): string {
  if (profileSlug) {
    return `${origin}/p/${profileSlug}/projects/${projectId}`;
  }
  return `${origin}/cloud/share/${projectId}`;
}
