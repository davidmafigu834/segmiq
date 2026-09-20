import Image from "next/image";

/**
 * Hero product visual — generated WhatsApp conversation + Agent activity overlay.
 * Assets: /public/segmiq/visuals/agent-whatsapp-hero.webp
 *         /public/segmiq/visuals/agent-activity-conversation.webp
 */
export default function AgenticHeroVisual() {
  return (
    <div
      className="relative mx-auto w-full max-w-[920px] select-none lg:mx-0 lg:max-w-none"
      aria-hidden
    >
      <div className="segmiq-hero-visual-glow pointer-events-none absolute -inset-8 -z-0 sm:-inset-12" />

      <div className="marketing-product-chrome relative z-[1] overflow-hidden rounded-[12px] shadow-[0_18px_50px_rgba(16,24,40,0.08)]">
        <Image
          src="/segmiq/visuals/agent-whatsapp-hero.webp"
          alt=""
          width={1024}
          height={682}
          priority
          sizes="(min-width: 1280px) 680px, (min-width: 1024px) 58vw, 92vw"
          className="h-auto w-full"
        />
      </div>

      <div className="absolute bottom-[-10%] right-0 z-[3] w-[min(248px,72%)] overflow-hidden rounded-[12px] shadow-[0_18px_45px_rgba(16,24,40,0.18)] sm:bottom-auto sm:right-[-3%] sm:top-[16%] sm:w-[236px] md:right-[-20px] lg:right-[-36px] xl:right-[-44px] xl:w-[252px]">
        <Image
          src="/segmiq/visuals/agent-activity-conversation.webp"
          alt=""
          width={711}
          height={650}
          sizes="252px"
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}
