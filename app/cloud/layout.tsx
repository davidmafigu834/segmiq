import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/seo";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";

export const viewport: Viewport = {
  themeColor: "#D4FF4F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: (() => {
    const raw = process.env.NEXT_PUBLIC_CLOUD_DOMAIN ?? SITE.cloudUrl;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(url);
  })(),
  title: {
    default: "Segmiq Cloud",
    template: "%s · Segmiq Cloud",
  },
  description:
    "Document your projects from the field. Upload photos, share with clients instantly.",
  alternates: { canonical: SITE.cloudUrl },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Segmiq Cloud",
    startupImage: "/icons/apple-touch-icon.png",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Segmiq Cloud",
    "msapplication-TileColor": "#D4FF4F",
    "msapplication-tap-highlight": "no",
  },
};

export default function CloudLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ServiceWorkerRegistration />
      {children}
    </div>
  );
}
