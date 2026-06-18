import { getCategoryAccentColor } from "../lib/categories";

export type Project = {
  id: string;
  title: string;
  category: string | null;
  updated_at: string;
  project_media?: { id: string; public_url: string; display_order: number }[];
};

type Props = {
  project: Project;
  onClick?: () => void;
};

function photoCount(project: Project): number {
  return project.project_media?.length ?? 0;
}

export function ProjectCard({ project, onClick }: Props) {
  const accent = getCategoryAccentColor(project.category);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-stretch overflow-hidden rounded-[20px] border border-black/[0.07] bg-card text-left shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="w-1.5 flex-shrink-0" style={{ background: accent }} />
      <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold text-ink">
            {project.title}
          </p>
          <p className="mt-0.5 text-[12px] text-warm">
            {photoCount(project)} photo{photoCount(project) !== 1 ? "s" : ""}
            {project.category ? ` · ${project.category}` : ""}
          </p>
        </div>
        <span className="text-warm text-lg">›</span>
      </div>
    </button>
  );
}
