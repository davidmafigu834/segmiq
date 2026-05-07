export type ProjectStyle = {
  gradient: string;
  border: string;
  titleColor: string;
  subtextColor: string;
  badgeTextColor: string;
  photoFallbackBg: string;
  photoIconColor: string;
};

const styles: Record<string, ProjectStyle> = {
  Construction: {
    gradient: "linear-gradient(145deg, #FFF4E8 0%, #FFCF8A 100%)",
    border: "rgba(230,140,0,0.25)",
    titleColor: "#7A3200",
    subtextColor: "#B05000",
    badgeTextColor: "#7A3200",
    photoFallbackBg: "#FFCF8A",
    photoIconColor: "#B05000",
  },
  Solar: {
    gradient: "linear-gradient(145deg, #E8F4FF 0%, #B8DAFF 100%)",
    border: "rgba(0,100,210,0.22)",
    titleColor: "#003580",
    subtextColor: "#1060CC",
    badgeTextColor: "#003580",
    photoFallbackBg: "#B8DAFF",
    photoIconColor: "#1060CC",
  },
  Landscaping: {
    gradient: "linear-gradient(145deg, #EAFFF0 0%, #B8F0CC 100%)",
    border: "rgba(0,160,70,0.22)",
    titleColor: "#00532A",
    subtextColor: "#007A3D",
    badgeTextColor: "#00532A",
    photoFallbackBg: "#B8F0CC",
    photoIconColor: "#007A3D",
  },
  Electrical: {
    gradient: "linear-gradient(145deg, #FFFDE0 0%, #FFF099 100%)",
    border: "rgba(200,160,0,0.25)",
    titleColor: "#5A4000",
    subtextColor: "#8C6A00",
    badgeTextColor: "#5A4000",
    photoFallbackBg: "#FFF099",
    photoIconColor: "#8C6A00",
  },
  Roofing: {
    gradient: "linear-gradient(145deg, #F2EDE8 0%, #D8C8B8 100%)",
    border: "rgba(140,90,40,0.22)",
    titleColor: "#4A2800",
    subtextColor: "#7A4A20",
    badgeTextColor: "#4A2800",
    photoFallbackBg: "#D8C8B8",
    photoIconColor: "#7A4A20",
  },
  Plumbing: {
    gradient: "linear-gradient(145deg, #E0FAFA 0%, #AAEAEA 100%)",
    border: "rgba(0,150,150,0.22)",
    titleColor: "#004848",
    subtextColor: "#007070",
    badgeTextColor: "#004848",
    photoFallbackBg: "#AAEAEA",
    photoIconColor: "#007070",
  },
  "Interior Design": {
    gradient: "linear-gradient(145deg, #FDE8F6 0%, #F4BCEB 100%)",
    border: "rgba(180,0,140,0.20)",
    titleColor: "#660052",
    subtextColor: "#990080",
    badgeTextColor: "#660052",
    photoFallbackBg: "#F4BCEB",
    photoIconColor: "#990080",
  },
  Fencing: {
    gradient: "linear-gradient(145deg, #F0EDE8 0%, #D8CEBC 100%)",
    border: "rgba(110,85,40,0.22)",
    titleColor: "#3A2800",
    subtextColor: "#6A4A18",
    badgeTextColor: "#3A2800",
    photoFallbackBg: "#D8CEBC",
    photoIconColor: "#6A4A18",
  },
  Events: {
    gradient: "linear-gradient(145deg, #FFE8F0 0%, #FFBFD8 100%)",
    border: "rgba(210,0,80,0.22)",
    titleColor: "#720038",
    subtextColor: "#AA0055",
    badgeTextColor: "#720038",
    photoFallbackBg: "#FFBFD8",
    photoIconColor: "#AA0055",
  },
};

const fallback: ProjectStyle = {
  gradient: "linear-gradient(145deg, #EDE8FF 0%, #D0C0FF 100%)",
  border: "rgba(100,60,220,0.22)",
  titleColor: "#3A006B",
  subtextColor: "#6A2AAA",
  badgeTextColor: "#3A006B",
  photoFallbackBg: "#D0C0FF",
  photoIconColor: "#6A2AAA",
};

export function getProjectStyle(category?: string | null): ProjectStyle {
  return category && styles[category] ? styles[category] : fallback;
}
