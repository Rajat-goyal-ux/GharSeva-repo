import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaInstall from "./pwa-install";
import { ADSENSE_CLIENT } from "./adsense-config";

export const metadata: Metadata = {
  title: "GharSeva — Paas ka trusted vendor",
  description: "Plumber, painter, electrician, labour aur home-service vendors ko area-wise dhoondhein, contact karein aur request track karein.",
  other: {
    "codex-preview": "development",
    "google-adsense-account": ADSENSE_CLIENT,
  },
  icons: {
    icon: [
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/app-icon-192.png",
    apple: "/app-icon-192.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GharSeva",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c6256",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi">
      <head>
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
