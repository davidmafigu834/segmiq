import Image from "next/image";

/**
 * SegmiQ Agent activity dashboard — generated product mockup.
 * Asset: /public/segmiq/visuals/agent-activity-dashboard.webp
 */
export default function AgentActivityPreview() {
  return (
    <figure className="segmiq-figure">
      <Image
        src="/segmiq/visuals/agent-activity-dashboard.webp"
        alt="SegmiQ Agent activity this morning: 14 conversations handling, 2 human needed, 6 follow-ups."
        width={552}
        height={717}
        sizes="(min-width: 1024px) 480px, 92vw"
        className="h-auto w-full"
      />
    </figure>
  );
}
