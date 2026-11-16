type GalleryPhoto = {
  type?: string;
  display_order: number;
};

export function formatCompletionDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function galleryPhotos<T extends GalleryPhoto>(media: T[]): T[] {
  return [...media]
    .filter((item) => item.type !== "video" && item.type !== "video_url")
    .sort((a, b) => a.display_order - b.display_order);
}

export function buildProjectPdfFilename(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "case-study";
  return `${base}.pdf`;
}
