import QRCode from "qrcode";
import {
  buildSpecMetaLine,
  formatCompletionDate,
  galleryPhotos,
  getInitials,
  hasAbsoluteLogo,
  HERO_SCRIM,
  printImageUrl,
  resolveTimelineStepPhotos,
  type ProjectMagazineData,
} from "@/lib/cloud/project-magazine";
import { CapabilitySectionPrint } from "@/components/profile/project-magazine/CapabilitySectionPrint";

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

function PrintContentPage({
  children,
  className = "",
  clientName,
  projectTitle,
}: {
  children: React.ReactNode;
  className?: string;
  clientName: string;
  projectTitle: string;
}) {
  return (
    <section className={`print-content-page ${className}`.trim()}>
      <RunningHeader clientName={clientName} projectTitle={projectTitle} />
      <div className="print-content-body">{children}</div>
    </section>
  );
}

export function ProjectMagazinePrint({ data, qrDataUrl }: PrintPageProps) {
  const { project, client, printCoverUrl, testimonial } = data;
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
  const hasStory = Boolean(storyBrief || pullQuote);
  const hasStorySection = hasStory || project.spec_fields.length > 0;
  const hasTimeline = project.timeline_steps.length > 0;

  return (
    <div
      className="print-root"
      style={{ ["--brand" as string]: brandColor, ["--brand-ink" as string]: "#FFFFFF" }}
    >
      <section className="print-cover-page">
        <RunningHeader clientName={clientName} projectTitle={project.title} />
        <div className={`print-cover ${printCoverUrl ? "" : "print-cover-fallback"}`}>
          {printCoverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={printImageUrl(printCoverUrl)}
              alt=""
              className="print-cover-img"
              loading="eager"
              decoding="sync"
            />
          )}
          {printCoverUrl && (
            <div className="print-cover-scrim" style={{ background: HERO_SCRIM }} />
          )}
          <div className="print-cover-content">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logo_url!} alt="" className="print-logo-chip" loading="eager" />
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

      {hasStorySection && (
        <PrintContentPage
          className="print-story-page"
          clientName={clientName}
          projectTitle={project.title}
        >
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
            </div>
            <PrintSpecCard specFields={project.spec_fields} brandColor={brandColor} />
          </div>
        </PrintContentPage>
      )}

      {storyResult && (
        <PrintContentPage
          className="print-results-page"
          clientName={clientName}
          projectTitle={project.title}
        >
          <div className="print-results-header">
            <p className="print-results-eyebrow">Results</p>
            <h2 className="print-results-title">The outcome</h2>
          </div>
          <div
            className="print-results-panel"
            style={{ background: `color-mix(in srgb, ${brandColor} 9%, #F7F4EF)` }}
          >
            <span className="print-results-accent" style={{ background: brandColor }} aria-hidden />
            <span className="print-results-mark" aria-hidden>&ldquo;</span>
            <p className="print-results-text">{storyResult}</p>
          </div>
        </PrintContentPage>
      )}

      {photos.length > 0 && (
        <PrintContentPage
          className="print-gallery-page"
          clientName={clientName}
          projectTitle={project.title}
        >
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
                      loading="eager"
                      decoding="sync"
                    />
              </div>
            ))}
          </div>
        </PrintContentPage>
      )}

      {(hasTimeline || testimonial) && (
        <PrintContentPage
          className="print-timeline-page"
          clientName={clientName}
          projectTitle={project.title}
        >
          {hasTimeline && (
            <div className="print-timeline-block">
              <h2 className="print-section-title">Timeline</h2>
              <ol className="print-timeline">
                {project.timeline_steps.map((step, stepIndex) => {
                  const stepPhotos = resolveTimelineStepPhotos(step, data.media);
                  return (
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
                      {stepPhotos.length > 0 && (
                        <div className="print-timeline-photos">
                          {stepPhotos.map((photo) => (
                            <div key={photo.id} className="print-timeline-photo">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={printImageUrl(photo.thumbnail_url ?? photo.public_url)}
                                alt={photo.caption ?? step.title ?? step.day_label}
                                className="print-timeline-img"
                                loading="eager"
                                decoding="sync"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                  );
                })}
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
        </PrintContentPage>
      )}

      {data.showCapabilitySection && (
        <PrintContentPage clientName={clientName} projectTitle={project.title}>
          <CapabilitySectionPrint
            clientName={clientName}
            brandColor={brandColor}
            capability={data.capability}
            publicProjectCount={data.publicProjectCount}
          />
        </PrintContentPage>
      )}

      <PrintContentPage
        className="print-cta-page"
        clientName={clientName}
        projectTitle={project.title}
      >
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
        <div className="print-content-footer">
          <span className="print-footer-page">
            Page <span className="page-num" /> of <span className="page-total" />
          </span>
          <span className="print-powered-by">
            <span className="print-lime-dot" aria-hidden />
            Powered by Segmiq
          </span>
        </div>
      </PrintContentPage>

      <style>{`
        @page { size: A4; margin: 0; }
        html, body {
          margin: 0;
          padding: 0;
          background: #fff !important;
          color: #1c1410 !important;
        }
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
        .print-content-footer {
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
        .print-content-page {
          width: 794px;
          padding: 42px 48px 48px;
          box-sizing: border-box;
          background: #fff;
        }
        .print-gallery-page,
        .print-timeline-page {
          break-before: page;
          page-break-before: always;
        }
        .print-cta-page {
          break-before: page;
          page-break-before: always;
          break-after: avoid;
          page-break-after: avoid;
          min-height: 1123px;
          display: flex;
          flex-direction: column;
        }
        .print-cta-page .print-content-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .print-cta-page .print-content-footer {
          margin-top: auto;
        }
        .print-content-body {
          width: 100%;
        }
        .print-content-footer {
          border-top: 1px solid rgba(28,20,16,0.1);
          padding-top: 10px;
          margin-top: 24px;
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
          min-height: 900px;
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
        .print-story-layout {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 24px;
          align-items: start;
        }
        .print-story-main {
          min-width: 0;
        }
        .print-spec-card {
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
          margin: 0 0 14px;
          font-size: 24px;
          break-after: avoid;
          page-break-after: avoid;
        }
        .print-results-page {
          break-before: page;
          page-break-before: always;
        }
        .print-results-header {
          break-inside: avoid;
          page-break-inside: avoid;
          break-after: avoid;
          page-break-after: avoid;
        }
        .print-results-eyebrow {
          margin: 0;
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #8c7b6b;
          font-family: system-ui, sans-serif;
          break-after: avoid;
          page-break-after: avoid;
        }
        .print-results-title {
          margin: 8px 0 0;
          font-size: 30px;
          line-height: 1.08;
          letter-spacing: -0.02em;
          break-after: avoid;
          page-break-after: avoid;
        }
        .print-results-panel {
          position: relative;
          margin-top: 28px;
          border-radius: 18px;
          padding: 36px 48px;
          overflow: hidden;
        }
        .print-results-accent {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
        }
        .print-results-mark {
          position: absolute;
          right: 20px;
          top: 10px;
          font-size: 72px;
          line-height: 1;
          font-weight: 700;
          color: color-mix(in srgb, var(--brand) 12%, transparent);
          font-family: Georgia, serif;
          pointer-events: none;
        }
        .print-results-text {
          position: relative;
          z-index: 1;
          margin: 0;
          width: 100%;
          max-width: none;
          font-size: 22px;
          line-height: 1.6;
          letter-spacing: -0.01em;
          font-weight: 500;
          text-align: left;
        }
        .print-gallery-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .print-gallery-hero {
          grid-column: 1 / -1;
          height: 220px;
        }
        .print-gallery-tile {
          height: 128px;
          border-radius: 10px;
          overflow: hidden;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .print-gallery-grid img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .print-timeline-block {
          margin-bottom: 24px;
        }
        .print-timeline {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .print-timeline-step {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
          break-inside: avoid;
          page-break-inside: avoid;
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
        .print-timeline-photos {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .print-timeline-photo {
          width: 118px;
          height: 78px;
          border-radius: 6px;
          overflow: hidden;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .print-timeline-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .print-testimonial {
          padding-top: 16px;
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
        .print-capability-block {
          margin-bottom: 8px;
        }
        .print-capability-client {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
        }
        .print-capability-tagline {
          margin: 8px 0 0;
          font-size: 14px;
          line-height: 1.6;
          color: #4a3828;
          font-family: system-ui, sans-serif;
        }
        .print-capability-subsection {
          margin-top: 18px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .print-capability-label {
          margin: 0 0 8px;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8c7b6b;
          font-family: system-ui, sans-serif;
        }
        .print-capability-glance {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .print-capability-stat-card,
        .print-capability-cert-card,
        .print-capability-team-card,
        .print-capability-stat-row {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .print-capability-stat-card {
          border: 1px solid rgba(28,20,16,0.1);
          border-radius: 10px;
          padding: 10px 12px;
          min-width: 140px;
        }
        .print-capability-stat-label {
          margin: 0;
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #8c7b6b;
          font-family: system-ui, sans-serif;
        }
        .print-capability-stat-value {
          margin: 4px 0 0;
          font-size: 20px;
          font-weight: 700;
        }
        .print-capability-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .print-capability-tag {
          border: 1px solid rgba(28,20,16,0.1);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-family: system-ui, sans-serif;
        }
        .print-capability-cert-grid,
        .print-capability-team-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .print-capability-cert-card {
          border: 1px solid rgba(28,20,16,0.1);
          border-radius: 10px;
          overflow: hidden;
        }
        .print-capability-cert-img {
          width: 100%;
          height: 90px;
          object-fit: cover;
          display: block;
        }
        .print-capability-cert-body {
          padding: 10px;
        }
        .print-capability-cert-name {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
        }
        .print-capability-cert-meta {
          margin: 4px 0 0;
          font-size: 11px;
          color: #8c7b6b;
          font-family: system-ui, sans-serif;
        }
        .print-capability-team-card {
          display: flex;
          gap: 10px;
          border: 1px solid rgba(28,20,16,0.1);
          border-radius: 10px;
          padding: 10px;
        }
        .print-capability-team-photo,
        .print-capability-team-fallback {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          flex-shrink: 0;
          object-fit: cover;
        }
        .print-capability-team-fallback {
          display: grid;
          place-items: center;
          color: var(--brand-ink);
          font-size: 11px;
          font-weight: 700;
          font-family: system-ui, sans-serif;
        }
        .print-capability-team-name {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
        }
        .print-capability-team-role {
          margin: 2px 0 0;
          font-size: 10px;
          color: #8c7b6b;
          font-family: system-ui, sans-serif;
        }
        .print-capability-team-bio {
          margin: 6px 0 0;
          font-size: 11px;
          line-height: 1.5;
          font-family: system-ui, sans-serif;
        }
        .print-capability-stats {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .print-capability-stat-row {
          border: 1px solid rgba(28,20,16,0.1);
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 8px;
        }
        .print-capability-stat-text {
          margin: 4px 0 0;
          font-size: 13px;
          line-height: 1.5;
          font-family: system-ui, sans-serif;
        }
        .print-capability-stat-date {
          color: #8c7b6b;
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
