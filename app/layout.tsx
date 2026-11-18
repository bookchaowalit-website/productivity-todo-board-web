import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

// canonical is the normalised SITE_URL itself (not "/"), so with a base path it matches the sitemap URL exactly.
export const metadata: Metadata = { metadataBase: new URL(SITE_URL), alternates: { canonical: SITE_URL }, title: "Todo Board | Bookchaowalit", description: "A local priority-aware todo board." };

// The font variable sits on <html>: the App shell tokens live on :root and read it from there.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={geistSans.variable}><body>{children}</body></html>;
}
