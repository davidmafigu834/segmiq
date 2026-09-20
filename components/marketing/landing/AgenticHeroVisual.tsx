import Image from "next/image";

/**
 * Hero product visual. Assets:
 * /public/segmiq/visuals/agent-whatsapp-hero.webp
 * /public/segmiq/visuals/agent-activity-conversation.webp
 */
export default function AgenticHeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[920px] select-none lg:mx-0 lg:max-w-none" aria-hidden>
      <figure className="segmiq-figure relative z-[1]">
        <Image
          src="/segmiq/visuals/agent-whatsapp-hero.webp"
          alt=""
          width={1024}
          height={682}
          priority
          sizes="(min-width: 1280px) 680px, (min-width: 1024px) 58vw, 92vw"
          className="h-auto w-full"
        />
      </figure>

      <figure className="segmiq-figure absolute bottom-[-10%] right-0 z-[3] w-[min(248px,72%)] sm:bottom-auto sm:right-[-3%] sm:top-[16%] sm:w-[236px] md:right-[-16px] lg:right-[-28px] xl:w-[252px]">
        <Image
          src="/segmiq/visuals/agent-activity-conversation.webp"
          alt=""
          width={711}
          height={650}
          sizes="252px"
          className="h-auto w-full"
        />
      </figure>
    </div>
  );
}
