import { formatCompletionDate, galleryPhotos } from "@/lib/cloud/magazine-format";
import type { ProjectMagazineData } from "@/lib/cloud/project-magazine";

export type IssuePhoto = {
  id: string;
  url: string;
  caption: string | null;
};

export type IssueRow = {
  label: string;
  value: string;
};

export type IssuePage =
  | {
      id: "cover";
      title: string;
      kicker: string;
      lead: string | null;
      imageUrl: string | null;
      clientName: string;
    }
  | {
      id: "record";
      title: string;
      paragraphs: string[];
      quote: string | null;
      quoteBy: string | null;
    }
  | { id: "plate"; title: string; photo: IssuePhoto }
  | { id: "pair" | "later"; title: string; photos: IssuePhoto[] }
  | {
      id: "specs" | "timeline" | "capability";
      title: string;
      heading: string;
      rows: IssueRow[];
      note: string | null;
    }
  | { id: "result"; title: string; paragraphs: string[] }
  | { id: "testimonial"; title: string; quote: string; by: string | null }
  | {
      id: "close";
      title: string;
      clientName: string;
      country: string | null;
      contactPath: string;
      projectsPath: string;
    };

function lines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function shortLead(text: string | null | undefined): string | null {
  const first = lines(text)[0];
  if (!first || first.length > 160) return null;
  return first;
}

function toPhoto(photo: { id: string; public_url: string; caption: string | null }): IssuePhoto {
  return {
    id: photo.id,
    url: photo.public_url,
    caption: photo.caption?.trim() || null,
  };
}

export function buildMagazineIssue(data: ProjectMagazineData): IssuePage[] {
  const { project, client, coverUrl, testimonial } = data;
  const clientName = client.name;
  const completion = formatCompletionDate(project.completion_date);
  const place = [project.location, completion].filter(Boolean).join(", ");
  const storySource = lines(project.story_brief).length ? project.story_brief : project.description;
  const storyLines = lines(storySource);
  const quote = project.pull_quote?.trim() || null;
  const quoteBy = project.pull_quote_by?.trim() || null;
  const lead = shortLead(storySource);
  const photos = galleryPhotos(data.media)
    .filter((photo) => photo.public_url !== coverUrl)
    .map(toPhoto);
  const profileHref = `/p/${data.slug}`;
  const pages: IssuePage[] = [];

  pages.push({
    id: "cover",
    title: project.title,
    kicker: place || project.category || "Project issue",
    lead,
    imageUrl: coverUrl,
    clientName,
  });

  const storyWorthAPage =
    storyLines.length > 1 ||
    (storyLines[0]?.length ?? 0) > 160 ||
    Boolean(quote && quote !== lead);

  if (storyWorthAPage && (storyLines.length > 0 || quote)) {
    pages.push({
      id: "record",
      title: "On record",
      paragraphs: storyLines,
      quote,
      quoteBy,
    });
  }

  const plate = photos[0];
  if (plate) {
    pages.push({
      id: "plate",
      title: plate.caption || "On site",
      photo: plate,
    });
  }

  const specRows = project.spec_fields
    .filter((field) => field.label.trim() && field.value.trim())
    .slice(0, 8)
    .map((field) => ({ label: field.label, value: field.value }));

  if (project.duration_label?.trim()) {
    specRows.push({ label: "Duration", value: project.duration_label.trim() });
  }
  if (project.show_budget && project.budget_range?.trim()) {
    specRows.push({ label: "Budget", value: project.budget_range.trim() });
  }

  if (specRows.length > 0) {
    pages.push({
      id: "specs",
      title: "What was decided",
      heading: "What was decided.",
      rows: specRows,
      note: null,
    });
  }

  const pair = photos.slice(1, 3);
  if (pair.length > 0) {
    pages.push({ id: "pair", title: "On site", photos: pair });
  }

  const later = photos.slice(3, 5);
  if (later.length > 0) {
    pages.push({ id: "later", title: "Later on site", photos: later });
  }

  const steps = project.timeline_steps
    .filter((step) => step.title.trim() || step.description.trim())
    .slice(0, 8)
    .map((step) => ({
      label: step.title.trim() || step.day_label.trim() || "Step",
      value: [step.day_label.trim(), step.description.trim()].filter(Boolean).join(". "),
    }))
    .filter((step) => step.value || step.label);

  if (steps.length > 0) {
    pages.push({
      id: "timeline",
      title: "How the days ran",
      heading: "How the days ran.",
      rows: steps,
      note: null,
    });
  }

  if (project.story_result?.trim()) {
    pages.push({
      id: "result",
      title: "The outcome",
      paragraphs: lines(project.story_result),
    });
  }

  const testimonialText = testimonial?.content.trim() || "";
  if (testimonial && testimonialText && testimonialText !== quote) {
    pages.push({
      id: "testimonial",
      title: "In their words",
      quote: testimonialText,
      by: [testimonial.author_name, testimonial.author_role].filter(Boolean).join(", ") || null,
    });
  }

  if (data.showCapabilitySection) {
    const capability = data.capability;
    const rows: IssueRow[] = [];
    if (capability.years_in_operation) {
      rows.push({ label: "Years", value: String(capability.years_in_operation) });
    }
    if (data.publicProjectCount > 0) {
      rows.push({ label: "Public projects", value: String(data.publicProjectCount) });
    }
    for (const stat of capability.capability_stats) {
      if (!stat.label.trim() || !stat.value.trim()) continue;
      rows.push({ label: stat.label, value: stat.value });
    }
    for (const cert of capability.certifications) {
      if (!cert.name.trim()) continue;
      const detail = [cert.issuing_body, cert.issued_year].filter(Boolean).join(", ");
      rows.push({ label: cert.name, value: detail || "Held" });
    }
    const industries = capability.industries_served.filter(Boolean);
    const tagline = capability.capability_tagline?.trim() || null;
    const shortTagline = tagline && tagline.length <= 48 ? tagline : null;
    const notes = [tagline && !shortTagline ? tagline : null, industries.length > 0 ? industries.join(", ") : null]
      .filter(Boolean)
      .join(" ");
    if (tagline || rows.length > 0 || industries.length > 0) {
      pages.push({
        id: "capability",
        title: clientName,
        heading: shortTagline || clientName,
        rows: rows.slice(0, 8),
        note: notes || null,
      });
    }
  }

  pages.push({
    id: "close",
    title: "Request a quote",
    clientName,
    country: client.country,
    contactPath: `${profileHref}#contact`,
    projectsPath: `${profileHref}/projects`,
  });

  return pages;
}
