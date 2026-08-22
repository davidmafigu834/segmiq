import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Instrument_Serif, DM_Sans, DM_Serif_Display, Roboto } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorkerCleanup } from "@/components/ServiceWorkerCleanup";
import { isCloudRequestHost } from "@/lib/cloud/manifest";
import { getMetadataBase, ROOT_METADATA } from "@/lib/seo";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-serif",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const quotationRoboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-quotation",
  display: "swap",
});

export const metadata: Metadata = {
  ...ROOT_METADATA,
  metadataBase: getMetadataBase(),
  icons: {
    icon: [
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "android-chrome", url: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { rel: "android-chrome", url: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Segmiq",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isCloudHost = isCloudRequestHost(headers().get("host"));

  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${GeistSans.variable} ${GeistMono.variable} ${dmSans.variable} ${dmSerif.variable} ${quotationRoboto.variable}`}
    >
      <head>
        {/* Prevent CRM/sales theme flash before hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;var crm=p.indexOf("/sales")===0||p.indexOf("/solo")===0||p.indexOf("/dashboard")===0||p.indexOf("/client")===0||p.indexOf("/onboard")===0||p.indexOf("/dev/sales-design-system")===0;if(!crm)return;var t=null;try{t=localStorage.getItem("segmiq-crm-theme")}catch(e){}if(t!=="light"&&t!=="dark"){try{t=localStorage.getItem("segmiq-marketing-theme")}catch(e){}}if(t!=="light"&&t!=="dark")t="dark";var h=document.documentElement;h.setAttribute("data-crm","");if(t==="light")h.setAttribute("data-crm-theme","light");else h.removeAttribute("data-crm-theme");h.style.colorScheme=t==="light"?"light":"dark"}catch(e){}})();`,
          }}
        />
        {isCloudHost ? (
          <>
            {/* No crossorigin — use-credentials breaks installability on some browsers */}
            <link rel="manifest" href="/manifest.webmanifest" />
            <script
              dangerouslySetInnerHTML={{
                __html: `if("serviceWorker"in navigator){navigator.serviceWorker.register("/sw.js",{scope:"/"})}`,
              }}
            />
          </>
        ) : (
          <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        )}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css" />
      </head>
      <body className="min-h-screen bg-surface-canvas font-sans text-sm text-ink-primary antialiased">
        <ServiceWorkerCleanup />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
