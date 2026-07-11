import QRCode from "qrcode";
import {
  buildSpecMetaLine,
  formatCompletionDate,
  galleryPhotos,
  getInitials,
  hasAbsoluteLogo,
  HERO_SCRIM,
  printImageUrl,
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
            <li key={`${field.label}-${index}`} className="print-spec-row">
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
  const photos = galleryPhotos(data.media);
  const hasStory = Boolean(storyBrief || storyResult || pullQuote);
  const hasStorySection = hasStory || project.spec_fields.length > 0;
  const hasTimeline = project.timeline_steps.length > 0;

  return (
    <div
      className="print-root"
      style={{ ["--brand" as string]: brandColor, ["--brand-ink" as string]: "#FFFFFF" }}
    >
      <section className="print-cover-page">
        <RunningHeader clientName={clientName} projectTitle={project.title} />
        <div className={`print-cover ${coverUrl ? "" : "print-cover-fallback"}`}>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={printImageUrl(coverUrl)} alt="" className="print-cover-img" crossOrigin="anonymous" />
          )}
          {coverUrl && (
            <div className="print-cover-scrim" style={{ background: HERO_SCRIM }} />
          )}
          <div className="print-cover-content">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logo_url!} alt="" className="print-logo-chip" crossOrigin="anonymous" />
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
        <div className="print-cover-footer">
          <span className="print-footer-page">
            Page <span className="page-num" /> of <span className="page-total" />
          </span>
        </div>
      </section>

      <div className="print-flow">
        <div className="print-fixed-header">
          <RunningHeader clientName={clientName} projectTitle={project.title} />
        </div>
        <div className="print-fixed-footer">
          <span className="print-footer-page">
            Page <span className="page-num" /> of <span className="page-total" />
          </span>
          <span className="print-powered-by">
            <span className="print-lime-dot" aria-hidden />
            Powered by Segmiq
          </span>
        </div>

        <main className="print-flow-content">
          {hasStorySection && (
            <section className="print-story-section">
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
            </section>
          )}

          {photos.length > 0 && (
            <section className="print-gallery-section">
              <h2 className="print-section-title">Gallery</h2>
              <div className="print-gallery-grid">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className={
                      index === 0 ? "print-gallery-hero print-gallery-tile" : "print-gallery-tile"
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={printImageUrl(photo.thumbnail_url ?? photo.public_url)}
                      alt={photo.caption ?? project.title}
                      crossOrigin="anonymous"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasTimeline && (
            <section className="print-timeline-section">
              <h2 className="print-section-title">Timeline</h2>
              <ol className="print-timeline">
                {project.timeline_steps.map((step, stepIndex) => (
                  <li key={`${step.day_label}-${stepIndex}`} className="print-timeline-step">
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
                      {step.title && <p className="print-timeline-title">{step.title}</p>}
                      {step.description && (
                        <p className="print-timeline-desc">{step.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {testimonial && (
            <section className="print-testimonial-section">
              <div className="print-testimonial">
                <p>&ldquo;{testimonial.content}&rdquo;</p>
                <span>
                  — {testimonial.author_name}
                  {testimonial.author_role ? `, ${testimonial.author_role}` : ""}
                </span>
              </div>
            </section>
          )}

          <section className="print-cta-section">
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
          </section>
        </main>
      </div>

      <style>{`
        @page { size: A4; margin: 90px 0 70px; }
        @page :first { margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
        .print-root {
          width: 794px;
          margin: 0 auto;
          background: #fff;
          color: #1c1410;
          font-family: Georgia, "Times New Roman", serif;
        }
        .page-num::after { content: counter(page); }
        .page-total::after { content: counter(pages); }
        .print-running-header,
        .print-cover-footer,
        .print-fixed-footer {
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
        .print-cover-page {
          width: 794px;
          min-height: 1123px;
          height: 1123px;
          padding: 42px 48px 36px;
          display: flex;
          flex-direction: column;
          background: #fff;
          page-break-after: always;
          break-after: page;
        }
        .print-cover-footer {
          border-top: 1px solid rgba(28,20,16,0.1);
          padding-top: 10px;
          margin-top: auto;
        }
        .print-flow {
          position: relative;
          width: 794px;
          background: #fff;
        }
        .print-fixed-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          width: 794px;
          margin: 0 auto;
          padding: 42px 48px 0;
          background: #fff;
          z-index: 20;
        }
        .print-fixed-header .print-running-header {
          margin-bottom: 0;
        }
        .print-fixed-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          width: 794px;
          margin: 0 auto;
          padding: 10px 48px 36px;
          border-top: 1px solid rgba(28,20,16,0.1);
          background: #fff;
          z-index: 20;
        }
        .print-flow-content {
          padding: 0 48px;
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
          break-inside: avoid;
          page-break-inside: avoid;
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
        .print-story-section,
        .print-gallery-section,
        .print-timeline-section,
        .print-testimonial-section,
        .print-cta-section {
          margin-bottom: 20px;
        }
        .print-story-layout {
          display: block;
        }
        .print-story-main {
          overflow: visible;
        }
        .print-spec-card {
          float: right;
          width: 220px;
          margin: 0 0 12px 20px;
          border: 1px solid rgba(28,20,16,0.12);
          border-radius: 14px;
          overflow: hidden;
          break-inside: avoid;
          page-break-inside: avoid;
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
        .print-spec-row {
          display: flex;
          gap: 10px;
          padding: 8px 0;
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
          margin: 0 0 12px;
          font-size: 24px;
          break-after: avoid;
          page-break-after: avoid;
        }
        .print-gallery-section {
          clear: both;
        }
        .print-gallery-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .print-gallery-hero {
          width: 100%;
          height: 180px;
        }
        .print-gallery-tile {
          width: calc(50% - 4px);
          height: 100px;
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
        .print-timeline-step {
          display: flex;
          gap: 12px;
          margin-bottom: 10px;
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
          padding: 16px 0 0;
          border-top: 1px solid rgba(28,20,16,0.1);
          break-inside: avoid;
          page-break-inside: avoid;
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
          break-inside: avoid;
          page-break-inside: avoid;
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
