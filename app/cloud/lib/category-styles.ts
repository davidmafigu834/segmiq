export type CategoryStyle = {
  sceneBg: string;
  overlayFrom: string;
  badge: string;
  labelColor: string;
};

const styles: Record<string, CategoryStyle> = {
  Construction:     { sceneBg: "#3A2A1A", overlayFrom: "rgba(28,20,12,0.85)",  badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  "Solar Installation": { sceneBg: "#1E2C18", overlayFrom: "rgba(16,24,12,0.85)", badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  Landscaping:      { sceneBg: "#1C2A1C", overlayFrom: "rgba(14,22,14,0.85)",  badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  Electrical:       { sceneBg: "#2C2A14", overlayFrom: "rgba(24,22,10,0.85)",  badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  Plumbing:         { sceneBg: "#1A2430", overlayFrom: "rgba(14,18,28,0.85)",  badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  "Interior Design":{ sceneBg: "#2C1C28", overlayFrom: "rgba(24,14,22,0.85)", badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  Roofing:          { sceneBg: "#2E2218", overlayFrom: "rgba(26,18,12,0.85)",  badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  Fencing:          { sceneBg: "#1E2C20", overlayFrom: "rgba(14,24,16,0.85)",  badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  Events:           { sceneBg: "#1E1C30", overlayFrom: "rgba(14,14,26,0.85)",  badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  Architecture:     { sceneBg: "#28261E", overlayFrom: "rgba(22,20,14,0.85)",  badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
  Other:            { sceneBg: "#2A2420", overlayFrom: "rgba(22,18,14,0.85)",  badge: "rgba(255,255,255,0.18)", labelColor: "#FFFFFF" },
};

const fallback: CategoryStyle = {
  sceneBg: "#2A2420",
  overlayFrom: "rgba(22,18,14,0.85)",
  badge: "rgba(255,255,255,0.18)",
  labelColor: "#FFFFFF",
};

export function getCategoryStyle(category: string | null | undefined): CategoryStyle {
  if (!category) return fallback;
  return styles[category] ?? fallback;
}
