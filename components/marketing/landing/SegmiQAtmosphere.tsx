/**
 * SegmiQ landing atmosphere — layered lighting, mesh, and faint network
 * details. Colour and intensity are driven by CSS so light/dark and
 * mobile breakpoints stay in one visual system.
 */
export default function SegmiQAtmosphere() {
  return (
    <div className="segmiq-atmosphere" aria-hidden>
      <div className="segmiq-atmosphere__base" />
      <div className="segmiq-atmosphere__mesh" />
      <div className="segmiq-atmosphere__grain" />
      <span className="segmiq-orb segmiq-orb--violet" />
      <span className="segmiq-orb segmiq-orb--blue" />
      <span className="segmiq-orb segmiq-orb--purple" />
      <span className="segmiq-orb segmiq-orb--lime" />
      <svg
        className="segmiq-atmosphere__network"
        viewBox="0 0 920 720"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M80 420C180 360 250 300 340 280C460 255 520 310 640 240C740 185 820 120 880 80" />
        <path d="M40 520C160 500 240 430 360 410C500 385 580 470 720 430C800 408 850 350 890 300" />
        <path d="M120 180C220 220 300 210 390 250C510 300 560 380 680 360" />
        <circle cx="340" cy="280" r="2.4" />
        <circle cx="640" cy="240" r="2.2" />
        <circle cx="360" cy="410" r="2" />
        <circle cx="720" cy="430" r="2.4" />
        <circle cx="390" cy="250" r="1.8" />
        <circle cx="680" cy="360" r="2.1" />
        <circle cx="880" cy="80" r="1.6" />
      </svg>
    </div>
  );
}
