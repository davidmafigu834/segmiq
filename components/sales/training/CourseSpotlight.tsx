"use client";

/**
 * Four-pane dim overlay so the highlighted target stays clickable.
 * Overlay: rgba(15, 23, 42, .45) light · slightly softer in dark.
 */

const PAD = 4;

export function CourseSpotlight({
  rect,
  missing,
  onBlockedClick,
}: {
  rect: DOMRect | null;
  missing?: boolean;
  onBlockedClick?: () => void;
}) {
  const z = "z-[var(--sales-z-course-overlay,90)]";

  if (!rect || missing) {
    return (
      <div
        className={`fixed inset-0 ${z} bg-[rgba(15,23,42,0.32)] dark:bg-[rgba(0,0,0,0.45)]`}
        aria-hidden
        onClick={onBlockedClick}
      />
    );
  }

  const top = Math.max(0, rect.top - PAD);
  const left = Math.max(0, rect.left - PAD);
  const right = Math.max(0, window.innerWidth - (rect.right + PAD));
  const bottom = Math.max(0, window.innerHeight - (rect.bottom + PAD));
  const holeWidth = rect.width + PAD * 2;
  const holeHeight = rect.height + PAD * 2;

  const pane =
    "fixed bg-[rgba(15,23,42,0.45)] dark:bg-[rgba(0,0,0,0.5)] pointer-events-auto";

  return (
    <div className={`pointer-events-none fixed inset-0 ${z}`} aria-hidden>
      {/* top */}
      <div
        className={pane}
        style={{ top: 0, left: 0, right: 0, height: top }}
        onClick={onBlockedClick}
      />
      {/* bottom */}
      <div
        className={pane}
        style={{ bottom: 0, left: 0, right: 0, height: bottom }}
        onClick={onBlockedClick}
      />
      {/* left */}
      <div
        className={pane}
        style={{ top, left: 0, width: left, height: holeHeight }}
        onClick={onBlockedClick}
      />
      {/* right */}
      <div
        className={pane}
        style={{ top, right: 0, width: right, height: holeHeight }}
        onClick={onBlockedClick}
      />
      {/* ring around target — pointer-events none */}
      <div
        className="pointer-events-none fixed rounded-[10px] ring-2 ring-[#D4FF4F] shadow-[0_0_0_3px_rgba(212,255,79,0.25)]"
        style={{
          top,
          left,
          width: holeWidth,
          height: holeHeight,
          zIndex: 1,
        }}
      />
    </div>
  );
}
