import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

import Providers from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  // No weight list: Inter is variable, so one file covers 100–900. A fixed
  // 400–700 list left the 80+ font-extrabold (800) headings rendering at 700.
});

export const metadata: Metadata = {
  title: "SiteOps",
  description: "SiteOps mobile-first construction operations app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // Translucent so the installed PWA's status bar takes the dark app colour
    // (viewportFit: cover + the header's safe-area padding already make room).
    statusBarStyle: "black-translucent",
    title: "SiteOps",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
      { url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  // Extend content under the notch / home indicator so the safe-area-inset env()
  // vars resolve to real values in standalone PWA mode (PWA1).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} bg-[#020617]`}>
      <body className="bg-[#020617] text-slate-200 antialiased min-h-dvh">
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
