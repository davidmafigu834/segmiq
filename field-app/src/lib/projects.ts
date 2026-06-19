import { apiGet, apiPost } from "./api";
import type { Project } from "../components/ProjectCard";

export type ProjectMedia = {
  id: string;
  public_url: string;
  display_order: number;
  caption?: string | null;
  type?: string;
};

export async function fetchProjects(clientId: string): Promise<{
  projects: Project[];
  error?: string;
}> {
  const res = await apiGet<Project[] | { error?: string }>(`/api/clients/${clientId}/projects`);
  if (!res.ok) {
    return { projects: [], error: (res.data as { error?: string }).error ?? "Failed to load projects." };
  }
  if (!Array.isArray(res.data)) return { projects: [] };
  const sorted = [...res.data].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  return { projects: sorted };
}

export async function fetchProjectMedia(
  clientId: string,
  projectId: string
): Promise<{ media: ProjectMedia[]; error?: string }> {
  const res = await apiGet<ProjectMedia[] | { error?: string }>(
    `/api/clients/${clientId}/projects/${projectId}/media`
  );
  if (!res.ok) {
    return { media: [], error: (res.data as { error?: string }).error ?? "Failed to load photos." };
  }
  return { media: Array.isArray(res.data) ? res.data : [] };
}

export type CreateProjectInput = {
  title: string;
  category?: string | null;
  location?: string | null;
  completion_date?: string | null;
  description?: string | null;
  is_featured?: boolean;
  is_public?: boolean;
};

export async function createProject(
  clientId: string,
  input: CreateProjectInput
): Promise<{ project?: Project; error?: string }> {
  const res = await apiPost<Project & { error?: string }>(`/api/clients/${clientId}/projects`, {
    title: input.title.trim(),
    category: input.category || null,
    location: input.location?.trim() || null,
    completion_date: input.completion_date || null,
    description: input.description?.trim() || null,
    is_featured: input.is_featured ?? false,
    is_public: input.is_public ?? true,
  });
  if (!res.ok) {
    return { error: (res.data as { error?: string }).error ?? "Failed to create project." };
  }
  return { project: res.data as Project };
}
