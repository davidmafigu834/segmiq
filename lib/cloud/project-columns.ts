/** Core project columns (pre-magazine migrations). */
export const BASE_PROJECT_COLUMNS = [
  "id",
  "client_id",
  "title",
  "slug",
  "category",
  "location",
  "description",
  "completion_date",
  "is_featured",
  "is_public",
  "display_order",
  "created_at",
  "updated_at",
  "duration_label",
  "budget_range",
  "show_budget",
] as const;

/** Added in 065_project_magazine_fields.sql */
export const MAGAZINE_PROJECT_COLUMNS = [
  "cover_media_id",
  "story_brief",
  "story_result",
  "pull_quote",
  "pull_quote_by",
  "timeline_steps",
  "spec_fields",
  "pdf_url",
  "pdf_generated_at",
] as const;

export function projectListSelect(includeMagazine: boolean): string {
  const cols = includeMagazine
    ? [...BASE_PROJECT_COLUMNS, ...MAGAZINE_PROJECT_COLUMNS].join(", ")
    : BASE_PROJECT_COLUMNS.join(", ");
  return `${cols}, project_media(id, public_url, display_order, caption, storage_key, milestone_id, type, thumbnail_url), project_milestones(id, is_completed)`;
}

export function projectRowSelect(includeMagazine: boolean): string {
  return includeMagazine
    ? [...BASE_PROJECT_COLUMNS, ...MAGAZINE_PROJECT_COLUMNS].join(", ")
    : BASE_PROJECT_COLUMNS.join(", ");
}

export function isMissingMagazineColumnError(message: string | undefined): boolean {
  if (!message) return false;
  return MAGAZINE_PROJECT_COLUMNS.some((col) => message.includes(col));
}
