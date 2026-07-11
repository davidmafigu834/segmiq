import Link from "next/link";
import {
  ArrowRight,
  MapPin,
} from "lucide-react";
import {
  buildProjectPdfFilename,
  buildSpecMetaLine,
  formatCompletionDate,
  galleryPhotos,
  getInitials,
  getSpecIcon,
  hasAbsoluteLogo,
  HERO_SCRIM,
  type ProjectMagazineData,
} from "@/lib/cloud/project-magazine";
import { ProjectPdfDownloadButton } from "@/components/profile/project-magazine/ProjectPdfDownloadButton";

function SpecIcon({ index, label }: { index: number; label: string }) {
  const Icon = getSpecIcon(index, label);
  return <Icon size={16} aria-hidden />;
}

function SpecSidebar({
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
    <aside className="shrink-0 lg:w-[280px]">
      <div className="overflow-hidden rounded-[18px] border border-[rgba(28,20,16,0.10)] bg-white shadow-[0_8px_30px_rgba(28,20,16,0.06)]">
        <div
          className="px-6 py-5 text-[var(--brand-ink)]"
          style={{ background: brandColor }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
            {headline.label}
          </p>
          <p className="mt-1 text-[clamp(28px,4vw,36px)] font-bold leading-none tracking-[-0.02em] [font-family:var(--fw-font-display)]">
            {headline.value}
          </p>
        </div>
        {rest.length > 0 && (
          <ul className="divide-y divide-[rgba(28,20,16,0.08)] px-5 py-2">
            {rest.map((field, index) => (
              <li key={`${field.label}-${index}`} className="flex items-start gap-3 py-3.5">
                <span className="mt-0.5 text-[var(--brand)]">
                  <SpecIcon index={index + 1} label={field.label} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fw-text-tertiary)]">
                    {field.label}
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold text-[var(--fw-text-primary)]">
                    {field.value}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export function ProjectMagazineScreen({ data }: { data: ProjectMagazineData }) {
  const { project, client, coverUrl, testimonial } = data;
  const brandColor = client.primary_color ?? "#0F7A4F";
  const clientName = client.name;
  const showLogo = hasAbsoluteLogo(client.logo_url);
  const photos = galleryPhotos(data.media);
  const specFields = project.spec_fields;
  const atAGlance = specFields.slice(0, 4);
  const storyBrief = project.story_brief?.trim() ?? "";
  const storyResult = project.story_result?.trim() ?? "";
  const pullQuote = project.pull_quote?.trim() ?? "";
  const pullQuoteBy = project.pull_quote_by?.trim() ?? "";
  const hasStory = Boolean(storyBrief || storyResult);
  const showPullQuoteInStory = Boolean(pullQuote);
  const metaLine = buildSpecMetaLine(specFields) ?? project.category;
  const completionLabel = formatCompletionDate(project.completion_date);
  const profileHref = `/p/${data.slug}`;
  const timelineSteps = project.timeline_steps;

  return (
    <div
      className="w-full bg-white text-[var(--fw-text-primary)] antialiased"
      style={{ ["--brand" as string]: brandColor, ["--brand-ink" as string]: "#FFFFFF" }}
    >
      {/* Cover */}
      <section
        className={`relative isolate flex min-h-[clamp(320px,58vh,520px)] w-full flex-col ${
          coverUrl
            ? "bg-cover bg-center bg-no-repeat"
            : "bg-[color-mix(in_srgb,var(--brand)_38%,#0a0907)]"
        }`}
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      >
        {coverUrl && (
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ background: HERO_SCRIM }}
            aria-hidden
          />
        )}

        <header className="relative z-[2] mx-auto mt-[18px] flex w-[calc(100%-44px)] max-w-[1040px] items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`${profileHref}#work`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-3.5 py-1.5 text-[12px] font-semibold text-white/90 no-underline backdrop-blur-sm transition-colors hover:bg-black/40"
            >
              ← Back to projects
            </Link>
            <ProjectPdfDownloadButton
              pdfDownloadUrl={data.pdfDownloadUrl}
              pdfDirectUrl={data.pdfDirectUrl}
              fileName={buildProjectPdfFilename(data.project.title)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-70"
            />
          </div>
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo_url!}
              alt={clientName}
              className="h-[38px] w-[38px] rounded-[9px] object-contain bg-white/90 p-1"
            />
          ) : (
            <div
              className="grid h-[38px] w-[38px] place-items-center rounded-[9px] bg-[var(--brand)] text-sm font-bold text-[var(--brand-ink)] [font-family:var(--fw-font-display)]"
              aria-hidden
            >
              {getInitials(clientName).slice(0, 1)}
            </div>
          )}
        </header>

        <div className="relative z-[2] mx-auto mt-auto w-full max-w-[1040px] px-7 pb-[56px]">
          <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
            <span className="inline-block h-0.5 w-[26px] bg-[var(--brand)]" aria-hidden />
            Case study
          </p>
          <h1 className="max-w-[18ch] text-[clamp(36px,5.5vw,58px)] font-bold leading-[1.04] tracking-[-0.02em] text-white [font-family:var(--fw-font-display)] [text-shadow:0_2px_30px_rgba(0,0,0,0.25)]">
            {project.title}
          </h1>
          {metaLine && (
            <p className="mt-3 max-w-[50ch] text-[15px] text-white/75">{metaLine}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/70">
            {project.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} aria-hidden />
                {project.location}
              </span>
            )}
            {completionLabel && <span>{completionLabel}</span>}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1040px] px-7">
        {atAGlance.length > 0 && (
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-[rgba(28,20,16,0.10)] bg-[rgba(28,20,16,0.10)] min-[821px]:grid-cols-4">
            {atAGlance.map((item, index) => (
              <div key={`${item.label}-${index}`} className="bg-white px-5 py-6 text-center">
                <p className="text-[clamp(22px,3vw,30px)] font-bold tracking-[-0.02em] text-[var(--brand)] [font-family:var(--fw-font-display)]">
                  {item.value}
                </p>
                <p className="mt-1 text-[12px] tracking-[0.04em] text-[var(--fw-text-tertiary)]">
                  {item.label}
                </p>
              </div>
            ))}
          </section>
        )}

        {(hasStory || specFields.length > 0) && (
          <section className={`py-16 ${atAGlance.length > 0 ? "border-t border-[rgba(28,20,16,0.10)]" : ""}`}>
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1">
                {hasStory && (
                  <>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
                      The story
                    </p>
                    {storyBrief && (
                      <p className="magazine-drop-cap mt-5 max-w-[62ch] text-lg leading-[1.8] text-[var(--fw-text-primary)]">
                        {storyBrief}
                      </p>
                    )}
                    {showPullQuoteInStory && (
                      <blockquote
                        className="my-8 border-l-4 pl-6 text-xl leading-[1.5] tracking-[-0.01em] text-[var(--fw-text-primary)] [font-family:var(--fw-font-display)]"
                        style={{ borderColor: brandColor }}
                      >
                        &ldquo;{pullQuote}&rdquo;
                        {pullQuoteBy && (
                          <footer className="mt-3 text-[13px] font-normal tracking-normal text-[var(--fw-text-tertiary)] [font-family:var(--fw-font-body)]">
                            — {pullQuoteBy}
                          </footer>
                        )}
                      </blockquote>
                    )}
                    {storyResult && (
                      <p className="max-w-[62ch] text-lg leading-[1.8] text-[var(--fw-text-primary)]">
                        {storyResult}
                      </p>
                    )}
                  </>
                )}
              </div>
              <SpecSidebar specFields={specFields} brandColor={brandColor} />
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section className="border-t border-[rgba(28,20,16,0.10)] py-16">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
              Gallery
            </p>
            <h2 className="mt-2.5 text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.02em] [font-family:var(--fw-font-display)]">
              On site
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-3 min-[821px]:grid-cols-4 min-[821px]:auto-rows-[180px]">
              {photos.map((photo, index) => {
                const isHero = index === 0;
                return (
                  <div
                    key={photo.id}
                    className={`overflow-hidden rounded-[14px] bg-[#e9e3d8] ${
                      isHero
                        ? "col-span-2 row-span-2 aspect-[16/10] min-[821px]:aspect-auto min-[821px]:min-h-[380px]"
                        : "aspect-square min-[821px]:aspect-auto"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.public_url}
                      alt={photo.caption ?? project.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {timelineSteps.length > 0 && (
          <section className="border-t border-[rgba(28,20,16,0.10)] py-16">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
              Timeline
            </p>
            <h2 className="mt-2.5 text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.08] tracking-[-0.02em] [font-family:var(--fw-font-display)]">
              How it unfolded
            </h2>
            <ol className="relative mt-10 space-y-0">
              {timelineSteps.map((step, index) => (
                <li key={`${step.day_label}-${index}`} className="relative flex gap-5 pb-10 last:pb-0">
                  {index < timelineSteps.length - 1 && (
                    <span
                      className="absolute left-[15px] top-8 bottom-0 w-px bg-[rgba(28,20,16,0.12)]"
                      aria-hidden
                    />
                  )}
                  <span
                    className="relative z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold text-[var(--brand-ink)]"
                    style={{ background: brandColor }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    {step.day_label && (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fw-text-tertiary)]">
                        {step.day_label}
                      </p>
                    )}
                    {step.title && (
                      <p className="mt-1 text-xl font-bold tracking-[-0.01em] [font-family:var(--fw-font-display)]">
                        {step.title}
                      </p>
                    )}
                    {step.description && (
                      <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.65] text-[var(--fw-text-secondary)]">
                        {step.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {testimonial && (
          <section className="border-t border-[rgba(28,20,16,0.10)] py-16">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--fw-text-tertiary)]">
              Testimonial
            </p>
            <blockquote className="mt-5 max-w-[52ch] text-[clamp(24px,3vw,32px)] leading-[1.4] tracking-[-0.01em] [font-family:var(--fw-font-display)]">
              &ldquo;{testimonial.content}&rdquo;
            </blockquote>
            <p className="mt-5 text-[13px] text-[var(--fw-text-tertiary)]">
              — {testimonial.author_name}
              {testimonial.author_role ? `, ${testimonial.author_role}` : ""}
            </p>
          </section>
        )}

        <section className="py-16">
          <div className="relative overflow-hidden rounded-[22px] bg-[#1C1410] px-[26px] py-10 text-[#F7F4EF] min-[821px]:px-12 min-[821px]:py-[50px]">
            <span className="absolute bottom-0 left-0 top-0 w-[5px] bg-[var(--brand)]" aria-hidden />
            <div className="mx-auto max-w-[640px] text-center">
              <h2 className="text-[clamp(26px,3.4vw,38px)] font-bold leading-[1.08] tracking-[-0.02em] [font-family:var(--fw-font-display)]">
                Want something like this?
              </h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={`${profileHref}#contact`}
                  className="inline-flex items-center justify-center gap-2 rounded-[11px] bg-[var(--brand)] px-[26px] py-3.5 text-sm font-semibold tracking-[0.01em] text-[var(--brand-ink)] no-underline transition-opacity hover:opacity-90"
                >
                  Request a quote
                  <ArrowRight size={15} aria-hidden />
                </a>
                <a
                  href={`${profileHref}#work`}
                  className="inline-flex items-center justify-center rounded-[11px] border border-[rgba(247,244,239,0.28)] bg-transparent px-[26px] py-3.5 text-sm font-semibold tracking-[0.01em] text-[#F7F4EF] no-underline transition-colors hover:border-[#F7F4EF]"
                >
                  See more projects
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-[18px] border-t border-[rgba(28,20,16,0.10)] py-[42px] pb-[60px]">
          <p className="text-[13px] leading-[1.7] text-[var(--fw-text-tertiary)]">
            <strong className="font-semibold text-[var(--fw-text-primary)]">{clientName}</strong>
            {client.country ? ` · ${client.country}` : ""}
          </p>
          <p className="flex items-center gap-[7px] text-[11px] tracking-[0.03em] text-[var(--fw-text-tertiary)]">
            <span className="h-[7px] w-[7px] shrink-0 rounded-[2px] bg-[#D4FF4F]" aria-hidden />
            Powered by{" "}
            <strong className="font-semibold text-[var(--fw-text-primary)]">Segmiq</strong>
          </p>
        </footer>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .magazine-drop-cap::first-letter {
              float: left;
              margin: 0.06em 0.12em 0 0;
              font-size: 3.4em;
              line-height: 0.82;
              font-weight: 700;
              color: var(--brand);
              font-family: var(--fw-font-display), Georgia, serif;
            }
          `,
        }}
      />
    </div>
  );
}
