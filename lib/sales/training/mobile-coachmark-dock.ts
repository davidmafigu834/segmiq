/**
 * Keep the mobile course card off the control the salesperson needs.
 * Targets in the lower half dock the card at the top so the composer and
 * bottom navigation stay reachable.
 */
export function mobileCourseDock(
  targetMidY: number | null,
  viewportHeight: number
): "top" | "bottom" {
  if (targetMidY == null || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return "top";
  return targetMidY > viewportHeight * 0.45 ? "top" : "bottom";
}
