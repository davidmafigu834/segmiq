import { revalidatePath } from "next/cache";

export function revalidateBlogPaths(slug?: string) {
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
}
