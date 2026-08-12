import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { content } from "@/lib/content";
import FluidField from "@/components/FluidField";
import "./globals.css";

/*
 * display: "swap", deliberately.
 *
 * "optional" would guarantee CLS 0, but it commits to the fallback for any page
 * load where the font misses a ~100ms window — measured here, that is every
 * cold visit, which means a first-time visitor sees the site in Arial. On a
 * portfolio the typography is the work, so that is the wrong trade.
 *
 * The cost is a 0.0079 cold-cache CLS: the hero is centred, so when the font
 * lands the glyphs re-centre. Giving the hero children fixed boxes does not
 * help — Chrome scores the text moving inside them, not just the boxes — so
 * with centred type and a swapped font, 0 is not reachable. 0.0079 is 13x
 * inside Google's 0.1 "good" threshold, and 0 on any warm cache.
 * Switch both to "optional" for a literal 0, at the price above.
 */
/* 700 is here for the Projects heading, which is drawn into a canvas at the
   family's heaviest real weight. Instrument Sans stops at 700 — its wght axis
   is 400–700 — so a heavier request would be synthesised, and synthetic bold
   rasterised into a texture smears in a way CSS text does not. */
const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-mono",
  display: "swap",
});

const { identity } = content;

export const metadata: Metadata = {
  title: `${identity.name} — ${identity.role}`,
  description: `${identity.headline} ${identity.sub}`,
  authors: [{ name: identity.name }],
  openGraph: {
    title: `${identity.name} — ${identity.role}`,
    description: identity.headline,
    type: "profile",
    locale: "en_US",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f3ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <FluidField />
        {children}
      </body>
    </html>
  );
}