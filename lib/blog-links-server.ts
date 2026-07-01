import { headers } from "next/headers";
import { blogPathPrefixFromHost } from "@/lib/blog-links";

export function getBlogPathPrefix(): string {
  const host = headers().get("host") ?? "";
  return blogPathPrefixFromHost(host);
}
