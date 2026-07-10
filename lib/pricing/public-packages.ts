import type { createAdminClient } from "@/lib/supabase/admin";
import { slugifyPackageName, uniquePackageSlug } from "@/lib/pricing/package-slug";

type AdminClient = ReturnType<typeof createAdminClient>;

export type PackagePublicRow = {
  is_public?: boolean | null;
  slug?: string | null;
  is_featured?: boolean;
  display_order?: number | null;
};

export function isPackagePublic(pkg: PackagePublicRow): boolean {
  return pkg.is_public === true && Boolean(pkg.slug?.trim());
}

export function sortPublicPackages<T extends PackagePublicRow>(packages: T[]): T[] {
  return packages.slice().sort((a, b) => {
    if (Boolean(a.is_featured) !== Boolean(b.is_featured)) {
      return a.is_featured ? -1 : 1;
    }
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });
}

export function buildPackageTeaser<T extends PackagePublicRow>(packages: T[], limit = 2): T[] {
  return sortPublicPackages(packages.filter(isPackagePublic)).slice(0, limit);
}

export async function resolvePublicPackageSlug(
  supabase: AdminClient,
  clientId: string,
  name: string,
  slugInput: string | null | undefined,
  excludeId?: string
): Promise<string> {
  const base = slugifyPackageName(slugInput?.trim() || name);
  return uniquePackageSlug(supabase, clientId, base, excludeId);
}
