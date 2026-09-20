import Image from "next/image";
import Link from "next/link";
import {
  FEATURED_CUSTOMER_STORY,
  type FeaturedCustomerStory,
} from "@/lib/marketing/featured-customer-story";

function IdentityBlock({ story }: { story: FeaturedCustomerStory }) {
  return (
    <footer className="mt-8">
      <cite className="not-italic text-[15px] font-semibold text-[var(--marketing-text)]">
        {story.name}
      </cite>
      <p className="mt-1 text-[13px] text-[var(--marketing-text-secondary)]">
        {story.role}, {story.company}
      </p>
    </footer>
  );
}

function StoryContent({ story }: { story: FeaturedCustomerStory }) {
  return (
    <div
      className={
        story.photo
          ? "grid gap-8 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] lg:items-center lg:gap-12"
          : ""
      }
    >
      {story.photo ? (
        <figure className="segmiq-figure relative aspect-[4/5] w-full overflow-hidden lg:aspect-auto lg:min-h-[360px]">
          <Image
            src={story.photo}
            alt={`${story.name}, ${story.role} at ${story.company}`}
            fill
            className="object-cover object-[center_18%]"
            sizes="(max-width: 1024px) 100vw, 38vw"
          />
        </figure>
      ) : null}

      <blockquote>
        <p className="text-[22px] font-medium leading-[1.35] tracking-[-0.02em] text-[var(--marketing-text)] sm:text-[26px] lg:text-[30px]">
          {story.quote}
        </p>
        <IdentityBlock story={story} />
        {story.caseStudyHref ? (
          <Link
            href={story.caseStudyHref}
            className="mt-6 inline-flex text-[13px] font-semibold text-[var(--marketing-link)] hover:text-[var(--marketing-link-hover)]"
          >
            Read customer story
          </Link>
        ) : null}
      </blockquote>
    </div>
  );
}

export default function CustomerStorySection() {
  const story = FEATURED_CUSTOMER_STORY;
  if (!story) return null;

  return (
    <section className="bg-[var(--marketing-bg)]" aria-labelledby="customer-story-heading">
      <div className="segmiq-shell pb-16 pt-8 sm:pb-20 lg:pb-24">
        <h2 id="customer-story-heading" className="sr-only">
          Customer story
        </h2>
        <StoryContent story={story} />
      </div>
    </section>
  );
}
