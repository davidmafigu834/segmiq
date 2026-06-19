import { Folder, ArrowRight } from "lucide-react";
import { getCategoryStyle } from "../lib/category-styles";

export type Project = {
  id: string;
  title: string;
  category: string | null;
  updated_at: string;
  project_media?: { id: string; public_url: string; display_order: number }[];
  project_milestones?: { id: string; is_completed: boolean }[];
};

type Props = {
  project: Project;
  onClick?: () => void;
};

function coverUrl(project: Project): string | null {
  const sorted = [...(project.project_media ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );
  return sorted[0]?.public_url ?? null;
}

function photoCount(project: Project): number {
  return project.project_media?.length ?? 0;
}

export function ProjectCard({ project, onClick }: Props) {
  const cat = getCategoryStyle(project.category);
  const cover = coverUrl(project);
  const count = photoCount(project);
  const milestones = project.project_milestones ?? [];

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full overflow-hidden rounded-[20px] border border-black/[0.08] bg-card text-left active:scale-[0.99] transition-transform"
    >
      <div className="relative h-[120px] overflow-hidden" style={{ background: cover ? cat.sceneBg : "#EDE9E3" }}>
        {cover ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={cover} alt={project.title} className="block h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to top, ${cat.overlayFrom} 0%, transparent 55%)` }}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Folder className="h-8 w-8 text-warm-muted" strokeWidth={1.5} />
          </div>
        )}

        <span
          className="absolute left-2 top-2 rounded-full px-[7px] py-0.5 font-fw-body text-[8px] font-bold uppercase tracking-wide"
          style={{ background: cat.badge, color: cat.labelColor }}
        >
          {project.category || "Project"}
        </span>

        <span className="absolute right-2 top-2 rounded-full bg-ink px-1.5 py-0.5 font-fw-body text-[8px] font-bold text-white">
          {count}
        </span>
      </div>

      <div className="px-3 pb-3.5 pt-2.5">
        <p className="font-fw-display mb-1.5 line-clamp-2 text-[13px] leading-tight text-ink">
          {project.title}
        </p>

        {milestones.length > 0 ? (
          (() => {
            const done = milestones.filter((m) => m.is_completed).length;
            const total = milestones.length;
            const pct = Math.round((done / total) * 100);
            return (
              <div className="mb-2">
                <div className="mb-1 h-[3px] rounded-sm bg-black/[0.08]">
                  <div
                    className="h-[3px] rounded-sm"
                    style={{
                      width: `${pct}%`,
                      background: pct === 100 ? "#D4FF4F" : "#1C1410",
                    }}
                  />
                </div>
                <span className="font-fw-body text-[8px] text-warm">
                  {done}/{total} milestones
                </span>
              </div>
            );
          })()
        ) : (
          <p className="mb-2 font-fw-body text-[9px] text-soil-3">In progress</p>
        )}

        <div className="flex items-center justify-between">
          <span className="font-fw-body text-[9px] font-bold text-soil-3">
            {count} photo{count !== 1 ? "s" : ""}
          </span>
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-sunken">
            <ArrowRight className="h-[11px] w-[11px] text-soil-3" strokeWidth={2} />
          </div>
        </div>
      </div>
    </button>
  );
}
