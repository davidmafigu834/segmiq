import Image from "next/image";

/**
 * WhatsApp Sales Hub — generated product mockup.
 * Asset: /public/segmiq/visuals/team-whatsapp-hub.webp
 */
export default function WhatsAppSalesHubPreview() {
  return (
    <div className="overflow-hidden rounded-[12px]">
      <Image
        src="/segmiq/visuals/team-whatsapp-hub.webp"
        alt="WhatsApp Sales Hub: Chiedza Ndlovu Human needed on a discount request, SegmiQ Agent briefing ready, Take over."
        width={1024}
        height={1024}
        sizes="(min-width: 1280px) 560px, 92vw"
        className="h-auto w-full"
      />
    </div>
  );
}
