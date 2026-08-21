"use client";

import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, X } from "lucide-react";

type DocumentRow = {
  id: string;
  name: string;
  description?: string | null;
  file_type?: string | null;
};

type ProjectRow = {
  id: string;
  title: string;
  category?: string | null;
};

type PackageRow = {
  id: string;
  name: string;
};

export function AssetDrawer({
  open,
  clientId,
  disabled,
  onClose,
  onSendDocument,
  onSendPortfolio,
  onSendTestimonials,
  onSendPackage,
}: {
  open: boolean;
  clientId: string;
  disabled?: boolean;
  onClose: () => void;
  onSendDocument: (id: string) => void;
  onSendPortfolio: () => void;
  onSendTestimonials: () => void;
  onSendPackage: (id: string) => void;
}) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/clients/${clientId}/documents`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/projects`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/clients/${clientId}/packages`).then((r) => r.json()),
    ])
      .then(([docs, projectsJson, pkgs]) => {
        if (cancelled) return;
        setDocuments((docs.documents as DocumentRow[] | undefined) ?? []);
        setProjects((projectsJson.projects as ProjectRow[] | undefined) ?? []);
        setPackages((pkgs.packages as PackageRow[] | undefined) ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  if (!open) return null;

  return (
    <div className="absolute inset-x-0 bottom-[72px] z-30 mx-3 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface shadow-[0_12px_32px_rgba(16,24,40,0.12)] sm:mx-4">
      <div className="flex items-center justify-between border-b border-sales-border px-3 py-2.5">
        <h3 className="text-[13px] font-semibold text-sales-text-primary">Send asset</h3>
        <button type="button" onClick={onClose} className="wa-icon-btn-muted !h-8 !w-8" aria-label="Close asset drawer">
          <X size={15} />
        </button>
      </div>
      <div className="inbox-scroll max-h-[min(52vh,420px)] overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-sales-text-secondary">
            <Loader2 size={14} className="animate-spin" /> Loading assets…
          </div>
        ) : (
          <div className="space-y-4">
            <Section title="Company assets">
              <AssetButton disabled={disabled} icon={<ImageIcon size={14} />} label="Company profile / portfolio" onClick={onSendPortfolio} />
              <AssetButton disabled={disabled} icon={<FileText size={14} />} label="Testimonials" onClick={onSendTestimonials} />
              {packages.map((pkg) => (
                <AssetButton
                  key={pkg.id}
                  disabled={disabled}
                  icon={<FileText size={14} />}
                  label={pkg.name}
                  onClick={() => onSendPackage(pkg.id)}
                />
              ))}
            </Section>
            {projects.length > 0 ? (
              <Section title="Project / case study assets">
                {projects.slice(0, 8).map((project) => (
                  <div key={project.id} className="flex min-h-9 items-center gap-2 rounded-[8px] px-2 text-[12px] text-sales-text-secondary">
                    <ImageIcon size={14} />
                    <span className="truncate text-sales-text-primary">{project.title}</span>
                    {project.category ? <span className="text-[10px] text-sales-text-muted">{project.category}</span> : null}
                  </div>
                ))}
                <p className="px-2 text-[10px] text-sales-text-muted">Send project photos from Documents if attached as files.</p>
              </Section>
            ) : null}
            <Section title="My files">
              {documents.length === 0 ? (
                <p className="px-2 py-1 text-[12px] text-sales-text-muted">No company documents yet.</p>
              ) : (
                documents.slice(0, 12).map((doc) => (
                  <AssetButton
                    key={doc.id}
                    disabled={disabled}
                    icon={<FileText size={14} />}
                    label={doc.name}
                    onClick={() => onSendDocument(doc.id)}
                  />
                ))
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-sales-text-muted">
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function AssetButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-[12px] text-sales-text-primary hover:bg-sales-surface-hover disabled:opacity-50"
    >
      <span className="text-sales-text-muted">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
