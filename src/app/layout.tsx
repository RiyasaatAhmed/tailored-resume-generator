import type { Metadata } from "next";
import { Saira_Condensed, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/*
  The three Bugatti faces are licensed and not public web fonts. These are the
  substitutes design-system.md names; preserving the three-family split —
  display / serif body / monospace — carries the voice, not the exact typeface.
  Every face loads weight 400 only: the system has no bold role.
*/
const display = Saira_Condensed({
  variable: "--font-display-loaded",
  subsets: ["latin"],
  weight: "400",
});

const body = Cormorant_Garamond({
  variable: "--font-body-loaded",
  subsets: ["latin"],
  weight: "400",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-loaded",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Tailored Resume Generator",
  description: "Tailor your resume to a job posting, without inventing anything.",
};

// Typed inline rather than with Next's generated `LayoutProps`, so `tsc
// --noEmit` runs without a prior `next build` to emit .next/types.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      {/*
        Browser extensions inject attributes into <body> before React hydrates
        (Bitdefender writes bis_register and __processed_<uuid>__), which React
        reports as a hydration mismatch. Next lists extensions as a known cause
        — nextjs.org/docs/messages/react-hydration-error, cause 5 — and both
        React and Next document suppressHydrationWarning as the escape hatch.
        It only works one level deep, so this covers <body> and nothing nested.
      */}
      <body
        className="min-h-full flex flex-col bg-canvas antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
