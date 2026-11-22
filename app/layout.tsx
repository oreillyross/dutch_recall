import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { LANG } from "@/lib/languages";
import Pwa from "./pwa";

export const metadata: Metadata = {
  title: "Langcards",
  description: "Learn words and phrases in another language with flashcards.",
  applicationName: "Langcards",
  appleWebApp: { capable: true, title: "Langcards", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: LANG.themeColor,
  viewportFit: "cover",
};

const { palette: P } = LANG;
// Accent colours come from the language config (light, then dark-mode tint of the same hue).
const THEME_CSS = `:root{--accent:${LANG.themeColor};--accent-ink:${P.ink};--accent-soft:${P.soft}}@media (prefers-color-scheme:dark){:root{--accent:${P.dark.color};--accent-ink:${P.dark.ink};--accent-soft:${P.dark.soft}}}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{THEME_CSS}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Pwa />
        <Analytics />
      </body>
    </html>
  );
}
