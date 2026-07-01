/** '' on blog.segmiq.com / blog.localhost; '/blog' when served at localhost:3000/blog */
export function blogPathPrefixFromHost(host: string): string {
  const hostname = host.split(":")[0];
  if (hostname === "blog.segmiq.com" || hostname.startsWith("blog.localhost")) return "";
  return "/blog";
}

/** Join blog path prefix with a root-relative blog path (`/`, `/slug`, `/category/x`). */
export function blogHref(prefix: string, path = "/"): string {
  if (path === "/" || path === "") return prefix || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${normalized}`;
}

export function blogHomeHref(prefix: string): string {
  return blogHref(prefix, "/");
}

export function blogPostHref(slug: string, prefix: string): string {
  return blogHref(prefix, `/${slug}`);
}

export function blogCategoryHref(category: string, prefix: string): string {
  return blogHref(prefix, `/category/${category}`);
}
