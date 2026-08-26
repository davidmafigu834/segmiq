import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  FEATURED_CUSTOMER_STORY,
  type FeaturedCustomerStory,
} from "@/lib/marketing/featured-customer-story";
import SegmiQSectionAtmosphere from "@/components/marketing/landing/atmosphere/SegmiQSectionAtmosphere";

function IdentityBlock({
  story,
  showPortrait = true,
}: {
  story: FeaturedCustomerStory;
  showPortrait?: boolean;
}) {
  const initials =
    story.initials ??
    story.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");

  return (
    <footer className="mt-8 flex flex-wrap items-end justify-between gap-6">
      <div className="flex items-center gap-3.5">
        {showPortrait && story.photo ? (
          <Image
            src={story.photo}
            alt={story.name}
            width={64}
            height={64}
            className="h-16 w-16 rounded-[14px] object-cover"
          />
        ) : showPortrait ? (
          <span
            className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(212,255,79,0.18)] text-[18px] font-semibold text-[#536600] dark:text-[#D4FF4F]"
            aria-hidden
          >
            {initials || "—"}
          </span>
        ) : null}
        <div>
          <cite className="not-italic text-[15px] font-semibold text-[var(--marketing-text)] sm:text-[16px]">
            {story.name}
          </cite>
          <p className="mt-0.5 text-[13px] text-[var(--marketing-text-secondary)]">{story.role}</p>
          <p className="text-[13px] text-[var(--marketing-text-secondary)]">{story.company}</p>
        </div>
      </div>

      {story.companyLogo ? (
        <Image
          src={story.companyLogo}
          alt={`${story.company} logo`}
          width={140}
          height={40}
          className="h-9 w-auto max-w-[140px] object-contain opacity-80"
        />
      ) : null}
    </footer>
  );
}

function ContextPanel({ story }: { story: FeaturedCustomerStory }) {
  const rows = [
    story.industry ? { label: "Industry", value: story.industry } : null,
    story.teamSize ? { label: "Team", value: story.teamSize } : null,
    story.usingFor ? { label: "Using SegmiQ for", value: story.usingFor } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (rows.length === 0) return null;

  return (
    <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--marketing-border-subtle)] pt-6 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="segmiq-kicker text-[10px] text-[var(--marketing-text-muted)]">
            {row.label}
          </dt>
          <dd className="mt-1 text-[13px] font-medium text-[var(--marketing-text-label)]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StoryContent({ story }: { story: FeaturedCustomerStory }) {
  return (
    <div
      className={`overflow-hidden rounded-[18px] border border-[var(--marketing-border)] bg-[var(--marketing-story-surface)] shadow-[var(--marketing-card-shadow)] segmiq-glass ${
        story.photo ? "lg:grid lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]" : ""
      }`}
    >
      {story.photo ? (
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-[rgba(8,18,42,0.55)] lg:aspect-auto lg:min-h-[420px]">
          <div
            className="pointer-events-none absolute inset-x-[12%] bottom-[10%] h-[36%] rounded-full bg-[rgba(52,88,164,0.38)] blur-3xl"
            aria-hidden
          />
          <Image
            src={story.photo}
            alt={`${story.name}, ${story.role} at ${story.company}`}
            fill
            className="object-contain object-[center_18%] drop-shadow-[0_12px_28px_rgba(8,20,48,0.45)] lg:rounded-l-[17px] [mask-image:linear-gradient(to_bottom,#000_78%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,#000_78%,transparent_100%)]"
            sizes="(max-width: 1024px) 100vw, 42vw"
          />
        </div>
      ) : null}

      <div className="relative px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        <span
          className="pointer-events-none absolute left-4 top-3 text-[64px] font-extrabold leading-none tracking-[-0.05em] text-[var(--marketing-quote-mark)] sm:left-6 sm:top-4 sm:text-[72px]"
          aria-hidden
        >
          “
        </span>

        <blockquote className="relative pt-8">
          <p className="text-[24px] font-medium leading-[1.32] tracking-[-0.02em] text-[var(--marketing-text)] sm:text-[28px] sm:leading-[1.3] lg:text-[32px] lg:leading-[1.28]">
            {story.quote}
          </p>
          <IdentityBlock story={story} showPortrait={!story.photo} />
          <ContextPanel story={story} />
          {story.caseStudyHref ? (
            <Link
              href={story.caseStudyHref}
              className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--marketing-link)] transition-colors hover:text-[var(--marketing-link-hover)] sm:text-[14px]"
            >
              Read customer story
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </blockquote>
      </div>
    </div>
  );
}

function PlaceholderStory() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-dashed border-[var(--marketing-border-strong)] bg-[var(--marketing-story-surface)] shadow-[var(--marketing-card-shadow)] segmiq-glass">
      <div className="relative px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <span
          className="pointer-events-none absolute left-4 top-3 text-[64px] font-extrabold leading-none tracking-[-0.05em] text-[var(--marketing-quote-mark)] sm:left-6 sm:text-[72px]"
          aria-hidden
        >
          “
        </span>
        <blockquote className="relative pt-8">
          <p className="text-[22px] font-medium leading-[1.35] tracking-[-0.02em] text-[var(--marketing-text-muted)] sm:text-[26px] lg:text-[28px]">
            Customer testimonial content to be added
          </p>
          <footer className="mt-8 flex flex-wrap items-center gap-4">
            <span
              className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(212,255,79,0.18)] text-[15px] font-semibold text-[#536600] dark:text-[#D4FF4F]"
              aria-hidden
            >
              —
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[var(--marketing-text-secondary)]">
                Approved customer name
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--marketing-text-muted)]">Role · Company</p>
            </div>
            <div
              className="ml-auto hidden h-9 w-[120px] rounded-md bg-[var(--marketing-hover)] sm:block"
              aria-hidden
            />
          </footer>
          <p className="mt-6 text-[12px] text-[var(--marketing-text-muted)]">
            Populate{" "}
            <code className="rounded bg-[var(--marketing-hover)] px-1.5 py-0.5 text-[11px] text-[var(--marketing-text-label)]">
              FEATURED_CUSTOMER_STORY
            </code>{" "}
            in{" "}
            <code className="rounded bg-[var(--marketing-hover)] px-1.5 py-0.5 text-[11px] text-[var(--marketing-text-label)]">
              lib/marketing/featured-customer-story.ts
            </code>{" "}
            with a verified quote, identity, and assets.
          </p>
        </blockquote>
      </div>
    </div>
  );
}

export default function CustomerStorySection() {
  const story = FEATURED_CUSTOMER_STORY;

  return (
    <section
      className="bg-[var(--marketing-bg)] marketing-halo marketing-halo--story"
      aria-labelledby="customer-story-heading"
    >
      <SegmiQSectionAtmosphere tone="story" />
      <div className="mx-auto max-w-[1280px] px-6 pb-14 pt-12 sm:px-10 sm:pb-16 sm:pt-14 lg:px-12 lg:pb-[72px] lg:pt-16">
        <div className="mx-auto max-w-[1100px]">
          <p
            id="customer-story-heading"
            className="segmiq-kicker text-center text-[11px] text-[var(--marketing-olive)] sm:text-[12px]"
          >
            Customer story
          </p>

          <div className="mt-6 sm:mt-7">
            {story ? <StoryContent story={story} /> : <PlaceholderStory />}
          </div>
        </div>
      </div>
    </section>
  );
}
