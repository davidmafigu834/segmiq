/**
 * Layout for the blog subdomain (blog.segmiq.com). Served internally at /blog/* via a middleware
 * host rewrite. Its own metadataBase so canonicals/OG resolve to the blog host.
 */

import type { Metadata } from "next";
import BlogHeader from "@/components/blog/BlogHeader";
import BlogFooter from "@/components/blog/BlogFooter";

export const metadata: Metadata = {
  metadataBase: new URL("https://blog.segmiq.com"),
  title: { default: "Segmiq Blog", template: "%s — Segmiq Blog" },
  description: "Specific writing on capturing and closing trade leads in Africa — solar, construction, roofing, electrical, landscaping.",
  alternates: { canonical: "https://blog.segmiq.com" },
  openGraph: { type: "website", siteName: "Segmiq Blog", url: "https://blog.segmiq.com" },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white text-[#0C0C0C] antialiased">
      <BlogHeader />
      <main>{children}</main>
      <BlogFooter />
    </div>
  );
}
