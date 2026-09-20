/**
 * SegmiQ landing atmosphere. Solid navy paper plus faint grain.
 * Colour stays on CSS tokens so light/dark remain one system.
 */
export default function SegmiQAtmosphere() {
  return (
    <div className="segmiq-atmosphere" aria-hidden>
      <div className="segmiq-atmosphere__base" />
      <div className="segmiq-atmosphere__grain" />
    </div>
  );
}
