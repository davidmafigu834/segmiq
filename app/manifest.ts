import type { MetadataRoute } from "next";
import { headers } from "next/headers";

function getAppDomain(): string {
  return (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "segmiq.com")
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0];
}

function isCloudHost(host: string): boolean {
  const appDomain = getAppDomain();
  return host === `cloud.${appDomain}` || host === "cloud.localhost";
}

const ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export default function manifest(): MetadataRoute.Manifest {
  const host = (headers().get("host") ?? "").split(":")[0];
  const onCloudHost = isCloudHost(host);
  const base = onCloudHost ? "" : "/cloud";

  return {
    name: "Segmiq Cloud",
    short_name: "Cloud",
    description: "Document your projects from the field. Upload photos, share with clients.",
    id: `${base}/dashboard/upload`,
    start_url: `${base}/dashboard/upload`,
    scope: onCloudHost ? "/" : "/cloud/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#D4FF4F",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "photo"],
    icons: ICONS,
    shortcuts: [
      {
        name: "Upload Photos",
        short_name: "Upload",
        description: "Upload photos to a project",
        url: `${base}/dashboard/upload`,
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "My Projects",
        short_name: "Projects",
        description: "View all projects",
        url: `${base}/dashboard/projects`,
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
