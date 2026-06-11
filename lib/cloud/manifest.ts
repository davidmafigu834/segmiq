import { headers } from "next/headers";

function getAppDomain(): string {
  return (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "segmiq.com")
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0];
}

export function isCloudHost(host: string): boolean {
  const appDomain = getAppDomain();
  return host === `cloud.${appDomain}` || host === "cloud.localhost";
}

function getOrigin(hostHeader: string): string {
  const host = hostHeader.split("/")[0];
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

const ICONS = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export function buildCloudManifest() {
  const hostHeader = headers().get("host") ?? "cloud.segmiq.com";
  const host = hostHeader.split(":")[0];
  const origin = getOrigin(hostHeader);
  const onCloudHost = isCloudHost(host);
  const base = onCloudHost ? "" : "/cloud";
  const startPath = `${base}/dashboard/upload`;
  const startUrl = `${origin}${startPath}`;
  const scope = onCloudHost ? `${origin}/` : `${origin}/cloud/`;

  return {
    name: "Segmiq Cloud",
    short_name: "Cloud",
    description: "Document your projects from the field. Upload photos, share with clients.",
    id: startUrl,
    start_url: startUrl,
    scope,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    prefer_related_applications: false,
    background_color: "#0a0a0a",
    theme_color: "#D4FF4F",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "photo"],
    icons: ICONS,
  };
}

export function isCloudRequestHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  return isCloudHost(hostHeader.split(":")[0]);
}
