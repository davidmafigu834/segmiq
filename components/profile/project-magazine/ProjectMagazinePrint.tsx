import QRCode from "qrcode";
import {
  buildSpecMetaLine,
  formatCompletionDate,
  galleryPhotos,
  getInitials,
  hasAbsoluteLogo,
  HERO_SCRIM,
  type ProjectMagazineData,
  type ProjectMediaRow,
} from "@/lib/cloud/project-magazine";

type PrintPageProps = {
  data: ProjectMagazineData;
  qrDataUrl: string;
};

type PageKind =
  | { kind: "cover" }
  | { kind: "story" }
  | {
      kind: "gallery";
      photos: ProjectMediaRow[];
      showHero: boolean;
      heroHeight: number;
      tileHeight: number;
    }
  | { kind: "timeline" }
  | { kind: "cta" };

const GALLERY_GRID_MAX_HEIGHT = 886;
const GALLERY_TILE_GAP = 10;
const GALLERY_MIN_HERO_HEIGHT = 260;
const GALLERY_MIN_TILE_HEIGHT = 130;

function measureGalleryHeight(
  photoCount: number,
  showHero: boolean,
  heroHeight = GALLERY_MIN_HERO_HEIGHT,
  tileHeight = GALLERY_MIN_TILE_HEIGHT
): number {
  if (photoCount === 0) return 0;

  const tileCount = showHero ? photoCount - 1 : photoCount;
  const rows = Math.ceil(tileCount / 2);
  let height = 0;

  if (showHero) {
    height += heroHeight;
    if (tileCount > 0) height += GALLERY_TILE_GAP;
  }

  if (rows > 0) {
    height += rows * tileHeight + Math.max(0, rows - 1) * GALLERY_TILE_GAP;
  }

  return height;
}

function getGalleryDimensions(photoCount: number, showHero: boolean) {
  const tileCount = showHero ? Math.max(0, photoCount - 1) : photoCount;
  const rows = Math.ceil(tileCount / 2) || 0;
  const gapCount = (showHero && tileCount > 0 ? 1 : 0) + Math.max(0, rows - 1);
  const gapHeight = gapCount * GALLERY_TILE_GAP;

  let heroHeight = showHero && photoCount > 0 ? GALLERY_MIN_HERO_HEIGHT : 0;
  let tileHeight = GALLERY_MIN_TILE_HEIGHT;

  if (rows > 0) {
    const remaining = GALLERY_GRID_MAX_HEIGHT - heroHeight - gapHeight;
    tileHeight = Math.min(200, Math.floor(remaining / rows));
    tileHeight = Math.max(GALLERY_MIN_TILE_HEIGHT, tileHeight);
  } else if (showHero) {
    heroHeight = GALLERY_GRID_MAX_HEIGHT;
  }

  if (showHero && rows > 0) {
    const used = heroHeight + gapHeight + rows * tileHeight;
    const leftover = GALLERY_GRID_MAX_HEIGHT - used;
    if (leftover > 0) heroHeight += leftover;
  }

  return { heroHeight, tileHeight };
}

function maxGalleryPhotosForPage(showHero: boolean): number {
  for (let count = 50; count >= 1; count -= 1) {
    const { heroHeight, tileHeight } = getGalleryDimensions(count, showHero);
    if (measureGalleryHeight(count, showHero, heroHeight, tileHeight) <= GALLERY_GRID_MAX_HEIGHT) {
      return count;
    }
  }
  return 1;
}

function buildGalleryChunks(photos: ProjectMediaRow[]): PageKind[] {
  if (photos.length === 0) return [];

  const pages: PageKind[] = [];
  let remaining = [...photos];
  let isFirst = true;

  while (remaining.length > 0) {
    const showHero = isFirst;
    const capacity = maxGalleryPhotosForPage(showHero);
    const count = Math.min(remaining.length, capacity);
    const chunk = remaining.slice(0, count);
    const { heroHeight, tileHeight } = getGalleryDimensions(chunk.length, showHero);

    pages.push({
      kind: "gallery",
      photos: chunk,
      showHero,
      heroHeight,
      tileHeight,
    });

    remaining = remaining.slice(count);
    isFirst = false;
  }

  return pages;
}

function buildPagePlan(data: ProjectMagazineData): PageKind[] {
  const { project, testimonial } = data;
  const photos = galleryPhotos(data.media);
  const storyBrief = project.story_brief?.trim() ?? "";
  const storyResult = project.story_result?.trim() ?? "";
  const pullQuote = project.pull_quote?.trim() ?? "";
  const hasStory = Boolean(storyBrief || storyResult || pullQuote);
  const hasStoryPage = hasStory || project.spec_fields.length > 0;
  const hasTimeline = project.timeline_steps.length > 0;
  const hasTestimonial = Boolean(testimonial);

  const plan: PageKind[] = [{ kind: "cover" }];
  if (hasStoryPage) plan.push({ kind: "story" });
  plan.push(...buildGalleryChunks(photos));
  if (hasTimeline || hasTestimonial) plan.push({ kind: "timeline" });
  plan.push({ kind: "cta" });
  return plan;
}

function RunningHeader({
  clientName,
  projectTitle,
}: {
  clientName: string;
  projectTitle: string;
}) {
  return (
    <div className="print-running-header">
      <span>{clientName}</span>
      <span>Case Study</span>
      <span>{projectTitle}</span>
    </div>
  );
}

function RunningFooter({
  pageNumber,
  totalPages,
  showPoweredBy,
}: {
  pageNumber: number;
  totalPages: number;
  showPoweredBy: boolean;
}) {
  return (
    <div className="print-running-footer">
      <span>
        Page {pageNumber} of {totalPages}
      </span>
      {showPoweredBy ? (
        <span className="print-powered-by">
          <span className="print-lime-dot" aria-hidden />
          Powered by Segmiq
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

function PrintPageShell({
  children,
  pageNumber,
  totalPages,
  clientName,
  projectTitle,
  showPoweredBy,
}: {
  children: React.ReactNode;
  pageNumber: number;
  totalPages: number;
  clientName: string;
  projectTitle: string;
  showPoweredBy: boolean;
}) {
  return (
    <section className="print-page">
      <RunningHeader clientName={clientName} projectTitle={projectTitle} />
      <div className="print-page-body">{children}</div>
      <RunningFooter
        pageNumber={pageNumber}
        totalPages={totalPages}
        showPoweredBy={showPoweredBy}
      />
    </section>
  );
}

function PrintSpecCard({
  specFields,
  brandColor,
}: {
  specFields: ProjectMagazineData["project"]["spec_fields"];
  brandColor: string;
}) {
  if (specFields.length === 0) return null;
  const headline = specFields[0]!;
  const rest = specFields.slice(1);

  return (
    <aside className="print-spec-card">
      <div className="print-spec-head" style={{ background: brandColor }}>
        <p className="print-spec-label">{headline.label}</p>
        <p className="print-spec-value">{headline.value}</p>
      </div>
      {rest.length > 0 && (
        <ul className="print-spec-list">
          {rest.map((field, index) => (
            <li key={`${field.label}-${index}`}>
              <span className="print-spec-icon" style={{ color: brandColor }}>
                •
              </span>
              <span>
                <strong>{field.label}</strong>
                <span>{field.value}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function ProjectMagazinePrint({ data, qrDataUrl }: PrintPageProps) {
  const { project, client, coverUrl, testimonial } = data;
  const brandColor = client.primary_color ?? "#0F7A4F";
  const clientName = client.name;
  const showLogo = hasAbsoluteLogo(client.logo_url);
  const storyBrief = project.story_brief?.trim() ?? "";
  const storyResult = project.story_result?.trim() ?? "";
  const pullQuote = project.pull_quote?.trim() ?? "";
  const pullQuoteBy = project.pull_quote_by?.trim() ?? "";
  const metaLine = buildSpecMetaLine(project.spec_fields) ?? project.category;
  const completionLabel = formatCompletionDate(project.completion_date);
  const hasTimeline = project.timeline_steps.length > 0;

  const pagePlan = buildPagePlan(data);
  const totalPages = pagePlan.length;

  return (
    <div
      className="print-root"
      style={{ ["--brand" as string]: brandColor, ["--brand-ink" as string]: "#FFFFFF" }}
    >
      {pagePlan.map((page, index) => {
        const pageNumber = index + 1;
        const shellProps = {
          pageNumber,
          totalPages,
          clientName,
          projectTitle: project.title,
          showPoweredBy: pageNumber === totalPages,
        };

        if (page.kind === "cover") {
          return (
            <PrintPageShell key="cover" {...shellProps}>
              <div className={`print-cover ${coverUrl ? "" : "print-cover-fallback"}`}>
                {coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="" className="print-cover-img" />
                )}
                {coverUrl && (
                  <div className="print-cover-scrim" style={{ background: HERO_SCRIM }} />
                )}
                <div className="print-cover-content">
                  {showLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={client.logo_url!} alt="" className="print-logo-chip" />
                  ) : (
                    <div className="print-logo-chip print-logo-fallback">
                      {getInitials(clientName).slice(0, 1)}
                    </div>
                  )}
                  <p className="print-eyebrow">Case study</p>
                  <h1>{project.title}</h1>
                  {metaLine && <p className="print-meta">{metaLine}</p>}
                  <div className="print-meta-row">
                    {project.location && <span>{project.location}</span>}
                    {completionLabel && <span>{completionLabel}</span>}
                  </div>
                </div>
              </div>
            </PrintPageShell>
          );
        }

        if (page.kind === "story") {
          return (
            <PrintPageShell key="story" {...shellProps}>
              <div className="print-story-layout">
                <div className="print-story-main">
                  {storyBrief && <p className="print-drop-cap">{storyBrief}</p>}
                  {pullQuote && (
                    <blockquote
                      className="print-pull-quote"
                      style={{ borderColor: brandColor }}
                    >
                      &ldquo;{pullQuote}&rdquo;
                      {pullQuoteBy && <footer>— {pullQuoteBy}</footer>}
                    </blockquote>
                  )}
                  {storyResult && <p className="print-body-text">{storyResult}</p>}
                </div>
                <PrintSpecCard specFields={project.spec_fields} brandColor={brandColor} />
              </div>
            </PrintPageShell>
          );
        }

        if (page.kind === "gallery") {
          const gridStyle = {
            ["--gallery-hero-height" as string]: `${page.heroHeight}px`,
            ["--gallery-tile-height" as string]: `${page.tileHeight}px`,
          };

          if (page.showHero) {
            const [hero, ...tiles] = page.photos;
            return (
              <PrintPageShell key={`gallery-${index}`} {...shellProps}>
                <h2 className="print-section-title">Gallery</h2>
                <div className="print-gallery-grid" style={gridStyle}>
                  {hero && (
                    <div className="print-gallery-hero">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={hero.public_url} alt={hero.caption ?? project.title} />
                    </div>
                  )}
                  {tiles.map((photo) => (
                    <div key={photo.id} className="print-gallery-tile">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.public_url} alt={photo.caption ?? project.title} />
                    </div>
                  ))}
                </div>
              </PrintPageShell>
            );
          }

          return (
            <PrintPageShell key={`gallery-${index}`} {...shellProps}>
              <h2 className="print-section-title">Gallery</h2>
              <div className="print-gallery-grid" style={gridStyle}>
                {page.photos.map((photo) => (
                  <div key={photo.id} className="print-gallery-tile">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.public_url} alt={photo.caption ?? project.title} />
                  </div>
                ))}
              </div>
            </PrintPageShell>
          );
        }

        if (page.kind === "timeline") {
          return (
            <PrintPageShell key="timeline" {...shellProps}>
              {hasTimeline && (
                <div className="print-timeline-block">
                  <h2 className="print-section-title">Timeline</h2>
                  <ol className="print-timeline">
                    {project.timeline_steps.map((step, stepIndex) => (
                      <li key={`${step.day_label}-${stepIndex}`}>
                        <span
                          className="print-timeline-dot"
                          style={{ background: brandColor }}
                        >
                          {stepIndex + 1}
                        </span>
                        <div>
                          {step.day_label && (
                            <p className="print-timeline-day">{step.day_label}</p>
                          )}
                          {step.title && (
                            <p className="print-timeline-title">{step.title}</p>
                          )}
                          {step.description && (
                            <p className="print-timeline-desc">{step.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {testimonial && (
                <div className="print-testimonial">
                  <p>&ldquo;{testimonial.content}&rdquo;</p>
                  <span>
                    — {testimonial.author_name}
                    {testimonial.author_role ? `, ${testimonial.author_role}` : ""}
                  </span>
                </div>
              )}
            </PrintPageShell>
          );
        }

        return (
          <PrintPageShell key="cta" {...shellProps}>
            <div className="print-cta-page">
              <div className="print-cta">
                <div>
                  <h3>Want something like this?</h3>
                  <p>Scan to view the live case study or request a quote.</p>
                  <p className="print-cta-url">{data.livePageUrl}</p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR code linking to live project page"
                  className="print-qr"
                />
              </div>
            </div>
          </PrintPageShell>
        );
      })}

      <style>{`
        @page { size: A4; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-root {
          background: #fff;
          color: #1c1410;
          font-family: Georgia, "Times New Roman", serif;
        }
        .print-page {
          width: 794px;
          height: 1123px;
          max-height: 1123px;
          box-sizing: border-box;
          padding: 42px 48px 36px;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #fff;
        }
        .print-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }
        .print-running-header,
        .print-running-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8c7b6b;
          font-family: system-ui, sans-serif;
          flex-shrink: 0;
        }
        .print-running-header {
          border-bottom: 1px solid rgba(28,20,16,0.1);
          padding-bottom: 10px;
          margin-bottom: 18px;
        }
        .print-running-footer {
          border-top: 1px solid rgba(28,20,16,0.1);
          padding-top: 10px;
          margin-top: auto;
        }
        .print-page-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .print-powered-by {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .print-lime-dot {
          width: 7px;
          height: 7px;
          border-radius: 2px;
          background: #D4FF4F;
          display: inline-block;
        }
        .print-cover {
          position: relative;
          flex: 1;
          min-height: 0;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
        }
        .print-cover-fallback {
          background: #0a0907;
          background-image: linear-gradient(145deg, color-mix(in srgb, var(--brand) 38%, #0a0907), #0a0907);
        }
        .print-cover-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .print-cover-scrim {
          position: absolute;
          inset: 0;
        }
        .print-cover-content {
          position: relative;
          z-index: 1;
          padding: 36px;
          color: #fff;
          width: 100%;
        }
        .print-logo-chip {
          width: 42px;
          height: 42px;
          border-radius: 9px;
          object-fit: contain;
          background: rgba(255,255,255,0.92);
          margin-bottom: 18px;
        }
        .print-logo-fallback {
          display: grid;
          place-items: center;
          background: var(--brand);
          color: var(--brand-ink);
          font-weight: 700;
          font-size: 16px;
        }
        .print-eyebrow {
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          opacity: 0.85;
          margin: 0 0 12px;
          font-family: system-ui, sans-serif;
        }
        .print-cover h1 {
          margin: 0;
          font-size: 42px;
          line-height: 1.05;
          max-width: 14ch;
        }
        .print-meta {
          margin: 12px 0 0;
          font-size: 14px;
          opacity: 0.8;
          font-family: system-ui, sans-serif;
        }
        .print-meta-row {
          margin-top: 10px;
          display: flex;
          gap: 16px;
          font-size: 12px;
          opacity: 0.75;
          font-family: system-ui, sans-serif;
        }
        .print-story-layout {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 24px;
          align-items: start;
          height: 100%;
          overflow: hidden;
        }
        .print-story-main {
          overflow: hidden;
        }
        .print-drop-cap::first-letter {
          float: left;
          font-size: 52px;
          line-height: 0.82;
          margin: 0.04em 0.1em 0 0;
          color: var(--brand);
          font-weight: 700;
        }
        .print-body-text,
        .print-drop-cap {
          font-size: 15px;
          line-height: 1.75;
          margin: 0 0 14px;
        }
        .print-pull-quote {
          margin: 18px 0;
          padding-left: 16px;
          border-left: 4px solid var(--brand);
          font-size: 20px;
          line-height: 1.45;
        }
        .print-pull-quote footer {
          margin-top: 8px;
          font-size: 12px;
          color: #8c7b6b;
          font-family: system-ui, sans-serif;
        }
        .print-spec-card {
          border: 1px solid rgba(28,20,16,0.12);
          border-radius: 14px;
          overflow: hidden;
        }
        .print-spec-head {
          padding: 16px;
          color: var(--brand-ink);
        }
        .print-spec-label {
          margin: 0;
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          opacity: 0.85;
          font-family: system-ui, sans-serif;
        }
        .print-spec-value {
          margin: 6px 0 0;
          font-size: 28px;
          font-weight: 700;
        }
        .print-spec-list {
          list-style: none;
          margin: 0;
          padding: 8px 14px;
        }
        .print-spec-list li {
          display: flex;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid rgba(28,20,16,0.08);
          font-family: system-ui, sans-serif;
          font-size: 12px;
        }
        .print-spec-list li:first-child { border-top: none; }
        .print-spec-icon {
          font-size: 18px;
          line-height: 1;
          flex-shrink: 0;
        }
        .print-spec-list strong {
          display: block;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8c7b6b;
        }
        .print-section-title {
          margin: 0 0 16px;
          font-size: 24px;
          flex-shrink: 0;
        }
        .print-gallery-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          align-content: start;
        }
        .print-gallery-hero {
          grid-column: 1 / -1;
          height: var(--gallery-hero-height, 260px);
          border-radius: 10px;
          overflow: hidden;
        }
        .print-gallery-tile {
          height: var(--gallery-tile-height, 130px);
          border-radius: 10px;
          overflow: hidden;
        }
        .print-gallery-grid img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .print-timeline-block {
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .print-timeline {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .print-timeline li {
          display: flex;
          gap: 12px;
          margin-bottom: 14px;
        }
        .print-timeline-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: var(--brand-ink);
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
          font-family: system-ui, sans-serif;
        }
        .print-timeline-day {
          margin: 0;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8c7b6b;
          font-family: system-ui, sans-serif;
        }
        .print-timeline-title {
          margin: 2px 0 0;
          font-size: 16px;
          font-weight: 700;
        }
        .print-timeline-desc {
          margin: 4px 0 0;
          font-size: 13px;
          line-height: 1.55;
          font-family: system-ui, sans-serif;
        }
        .print-testimonial {
          margin-top: 20px;
          padding: 16px 0 0;
          border-top: 1px solid rgba(28,20,16,0.1);
        }
        .print-testimonial p {
          margin: 0;
          font-size: 22px;
          line-height: 1.4;
        }
        .print-testimonial span {
          display: block;
          margin-top: 10px;
          font-size: 12px;
          color: #8c7b6b;
          font-family: system-ui, sans-serif;
        }
        .print-cta-page {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .print-cta {
          width: 100%;
          padding: 28px;
          border-radius: 14px;
          background: #1c1410;
          color: #f7f4ef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          font-family: system-ui, sans-serif;
        }
        .print-cta h3 {
          margin: 0;
          font-size: 22px;
          font-family: Georgia, serif;
        }
        .print-cta p {
          margin: 8px 0 0;
          font-size: 12px;
          opacity: 0.75;
        }
        .print-cta-url {
          font-size: 10px !important;
          word-break: break-all;
          opacity: 0.55 !important;
        }
        .print-qr {
          width: 96px;
          height: 96px;
          background: #fff;
          padding: 6px;
          border-radius: 8px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}

export async function generatePrintQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 180,
    color: { dark: "#1C1410", light: "#FFFFFF" },
  });
}
