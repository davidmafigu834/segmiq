import Image from "next/image";

/**
 * SegmiQ Agent activity dashboard — generated product mockup.
 * Asset: /public/segmiq/visuals/agent-activity-dashboard.webp
 */
export default function AgentActivityPreview() {
  return (
    <div className="marketing-product-chrome overflow-hidden rounded-[12px] shadow-[0_18px_45px_rgba(16,24,40,0.08)]">
      <Image
        src="/segmiq/visuals/agent-activity-dashboard.webp"
        alt="SegmiQ Agent activity this morning: 14 conversations handling, 2 human needed, 6 follow-ups."
        width={552}
        height={717}
        sizes="(min-width: 1024px) 480px, 92vw"
        className="h-auto w-full"
      />
    </div>
  );
}
