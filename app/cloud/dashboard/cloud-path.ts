/** cloud.segmiq.com uses /dashboard/* in the browser; internal routes use /cloud/dashboard/*. */
export function normalizeCloudDashboardPath(pathname: string): string {
  if (pathname === "/dashboard") return "/cloud/dashboard";
  if (pathname.startsWith("/dashboard/")) return `/cloud${pathname}`;
  return pathname;
}

export function matchesCloudDashboardPath(pathname: string, suffix: string): boolean {
  const normalized = normalizeCloudDashboardPath(pathname);
  return normalized === `/cloud/dashboard${suffix}` || normalized.startsWith(`/cloud/dashboard${suffix}/`);
}
