import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Mir MD Muhtasim Hasan · Full-stack developer, Dhaka";
const DESCRIPTION =
  "Full-stack developer in Mohammadpur, Dhaka. Fly through a neon Dhaka to see my tech stack and the websites I've shipped.";

/** The live site: metadata and the share image resolve against it. */
const SITE_URL = "https://muhtasim-hasan.vercel.app";

// The share image is app/opengraph-image.jpg (the hero frame, 1200 x 630).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Muhtasim",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
