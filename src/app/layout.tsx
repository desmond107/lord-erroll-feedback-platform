import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Share Your Experience · The Lord Erroll", template: "%s · The Lord Erroll" },
  description: "Tell The Lord Erroll Gourmet Restaurant about your visit. Every word is read by our owner.",
  applicationName: "The Lord Erroll",
  icons: { icon: [{ url: "/favicon.png", sizes: "32x32" }, { url: "/icon-192.png", sizes: "192x192" }], apple: "/apple-icon.png" },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf5ea" },
    { media: "(prefers-color-scheme: dark)", color: "#141614" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
