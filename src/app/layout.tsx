import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Newsreader } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "GapLens: Find what's missing", template: "%s · GapLens" },
  description:
    "GapLens analyses multiple sources for a research question and surfaces information gaps, contradictions, outdated information, unanswered questions and a verification checklist, all linked to evidence.",
  applicationName: "GapLens",
};

export const viewport: Viewport = { themeColor: "#fafaf8" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable}`}>
      <body className="min-h-dvh font-sans">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
