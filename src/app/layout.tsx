import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        Browser extensions inject attributes into <body> before React hydrates
        (Bitdefender writes bis_register and __processed_<uuid>__), which React
        reports as a hydration mismatch. Next lists extensions as a known cause
        — nextjs.org/docs/messages/react-hydration-error, cause 5 — and both
        React and Next document suppressHydrationWarning as the escape hatch.
        It only works one level deep, so this covers <body> and nothing nested.
      */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
