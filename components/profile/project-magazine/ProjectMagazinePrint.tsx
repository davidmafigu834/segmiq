import QRCode from "qrcode";
import {
  buildSpecMetaLine,
  formatCompletionDate,
  galleryPhotos,
  getInitials,
  getSpecIcon,
  hasAbsoluteLogo,
  HERO_SCRIM,
  type ProjectMagazineData,
} from "@/lib/cloud/project-magazine";

type PrintPageProps = {
  data: ProjectMagazineData;
  qrDataUrl: string;
};

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
          {rest.map((field, index) => {
            const Icon = getSpecIcon(index + 1, field.label);
            return (
              <li key={`${field.label}-${index}`}>
                <span className="print-spec-icon">
                  <Icon size={14} aria-hidden />
                </span>
                <span>
                  <strong>{field.label}</strong>
                  <span>{field.value}</span>
                </span>
              </li>
            );
          })}
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
  const photos = galleryPhotos(data.media);
  const storyBrief = project.story_brief?.trim() ?? "";
  const storyResult = project.story_result?.trim() ?? "";
  const pullQuote = project.pull_quote?.trim() ?? "";
  const pullQuoteBy = project.pull_quote_by?.trim() ?? "";
  const hasStory = Boolean(storyBrief || storyResult || pullQuote);
  const hasStoryPage = hasStory || project.spec_fields.length > 0;
  const hasGalleryPage = photos.length > 0;
  const hasTimeline = project.timeline_steps.length > 0;
  const hasTestimonial = Boolean(testimonial);
  const hasClosingPage = hasTimeline || hasTestimonial || true;
  const metaLine = buildSpecMetaLine(project.spec_fields) ?? project.category;
  const completionLabel = formatCompletionDate(project.completion_date);

  const pageFlags = [
    true,
    hasStoryPage,
    hasGalleryPage,
    hasClosingPage,
  ];
  const totalPages = pageFlags.filter(Boolean).length;
  let pageNumber = 0;

  return (
    <div
      className="print-root"
      style={{ ["--brand" as string]: brandColor, ["--brand-ink" as string]: "#FFFFFF" }}
    >
      {/* Cover page */}
      {(() => {
        pageNumber += 1;
        const current = pageNumber;
        return (
          <PrintPageShell
            pageNumber={current}
            totalPages={totalPages}
            clientName={clientName}
            projectTitle={project.title}
            showPoweredBy={current === totalPages}
          >
            <div
              className={`print-cover ${coverUrl ? "print-cover-photo" : "print-cover-fallback"}`}
              style={
                coverUrl
                  ? { backgroundImage: `url(${coverUrl})` }
                  : undefined
              }
            >
              {coverUrl && <div className="print-cover-scrim" style={{ background: HERO_SCRIM }} />}
              <div className="print-cover-content">
                {showLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={client.logo_url!} alt="" className="print-logo-chip" />
                ) : (
                  <div className="print-logo-chip print-logo-fallback">{getInitials(clientName).slice(0, 1)}</div>
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
      })()}

      {/* Story + spec */}
      {hasStoryPage && (() => {
        pageNumber += 1;
        const current = pageNumber;
        return (
          <PrintPageShell
            pageNumber={current}
            totalPages={totalPages}
            clientName={clientName}
            projectTitle={project.title}
            showPoweredBy={current === totalPages}
          >
            <div className="print-story-layout">
              <div className="print-story-main">
                {storyBrief && <p className="print-drop-cap">{storyBrief}</p>}
                {pullQuote && (
                  <blockquote className="print-pull-quote" style={{ borderColor: brandColor }}>
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
      })()}

      {/* Gallery */}
      {hasGalleryPage && (() => {
        pageNumber += 1;
        const current = pageNumber;
        const hero = photos[0]!;
        const rest = photos.slice(1);
        return (
          <PrintPageShell
            pageNumber={current}
            totalPages={totalPages}
            clientName={clientName}
            projectTitle={project.title}
            showPoweredBy={current === totalPages}
          >
            <h2 className="print-section-title">Gallery</h2>
            <div className="print-gallery-grid">
              <div className="print-gallery-hero">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero.public_url} alt={hero.caption ?? project.title} />
              </div>
              {rest.map((photo) => (
                <div key={photo.id} className="print-gallery-tile">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.public_url} alt={photo.caption ?? project.title} />
                </div>
              ))}
            </div>
          </PrintPageShell>
        );
      })()}

      {/* Timeline + testimonial + CTA */}
      {hasClosingPage && (() => {
        pageNumber += 1;
        const current = pageNumber;
        return (
          <PrintPageShell
            pageNumber={current}
            totalPages={totalPages}
            clientName={clientName}
            projectTitle={project.title}
            showPoweredBy
          >
            {hasTimeline && (
              <div className="print-timeline-block">
                <h2 className="print-section-title">Timeline</h2>
                <ol className="print-timeline">
                  {project.timeline_steps.map((step, index) => (
                    <li key={`${step.day_label}-${index}`}>
                      <span className="print-timeline-dot" style={{ background: brandColor }}>
                        {index + 1}
                      </span>
                      <div>
                        {step.day_label && <p className="print-timeline-day">{step.day_label}</p>}
                        {step.title && <p className="print-timeline-title">{step.title}</p>}
                        {step.description && <p className="print-timeline-desc">{step.description}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {hasTestimonial && testimonial && (
              <div className="print-testimonial">
                <p>&ldquo;{testimonial.content}&rdquo;</p>
                <span>
                  — {testimonial.author_name}
                  {testimonial.author_role ? `, ${testimonial.author_role}` : ""}
                </span>
              </div>
            )}

            <div className="print-cta">
              <div>
                <h3>Want something like this?</h3>
                <p>Scan to view the live case study or request a quote.</p>
                <p className="print-cta-url">{data.livePageUrl}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR code linking to live project page" className="print-qr" />
            </div>
          </PrintPageShell>
        );
      })()}

      <style>{`
        @page { size: A4; margin: 0; }
        .print-root {
          background: #fff;
          color: #1c1410;
          font-family: Georgia, "Times New Roman", serif;
        }
        .print-page {
          width: 794px;
          min-height: 1123px;
          box-sizing: border-box;
          padding: 42px 48px 36px;
          page-break-after: always;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .print-page:last-child { page-break-after: auto; }
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
        .print-page-body { flex: 1; min-height: 0; }
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
          min-height: 980px;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
        }
        .print-cover-photo { background-size: cover; background-position: center; }
        .print-cover-fallback { background: color-mix(in srgb, var(--brand) 38%, #0a0907); }
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
        }
        .print-gallery-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .print-gallery-hero {
          grid-column: 1 / -1;
          height: 280px;
          border-radius: 10px;
          overflow: hidden;
        }
        .print-gallery-tile {
          height: 150px;
          border-radius: 10px;
          overflow: hidden;
        }
        .print-gallery-grid img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
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
          margin: 20px 0;
          padding: 16px 0;
          border-top: 1px solid rgba(28,20,16,0.1);
          border-bottom: 1px solid rgba(28,20,16,0.1);
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
        .print-cta {
          margin-top: 24px;
          padding: 20px;
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
        }
      `}</style>
    </div>
  );
}

export async function generatePrintQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 180, color: { dark: "#1C1410", light: "#FFFFFF" } });
}
