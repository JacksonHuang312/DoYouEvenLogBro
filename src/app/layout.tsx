import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { DialogHost } from "@/components/DialogHost";
import { RpgDialogHost } from "@/components/rpg/RpgDialogHost";
import { FirestoreReconnect } from "@/components/FirestoreReconnect";
import { ThemeApplier } from "@/components/ThemeApplier";
import { TouchActive } from "@/components/TouchActive";
import { themeCss, themeScript } from "@/lib/themes";
import "./globals.css";

// The RPG screens' type (GAME_DESIGN.md 7.1). Exposed as CSS variables; only the .font-rpg-* utilities use them.
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-barlow", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  // Link previews (Discord, iMessage, X) need absolute image URLs; relative ones resolve against this.
  metadataBase: new URL("https://doyouevenlogbro.vercel.app"),
  title: "Do You Even Log Bro",
  description: "Free workout tracker: log sets, reps and weight.",
  // The preview card: the dumbbell icon as a small square thumbnail ("summary" card).
  openGraph: {
    type: "website",
    siteName: "Do You Even Log Bro?",
    title: "Do You Even Log Bro",
    description: "Free workout tracker: log sets, reps and weight.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Mint dumbbell logo" }],
  },
  twitter: { card: "summary" },
  applicationName: "Log Bro",
  // Home-screen app on iPhone: full-screen, no Safari bars. "black" (not "black-translucent")
  // keeps pages below the status bar, so sticky headers pinned at top: 0 never sit under the clock.
  appleWebApp: { capable: true, title: "Log Bro", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  // Lets the layout extend under the iPhone home bar; safe-area padding keeps controls clear of it.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme before React hydrates.
    <html lang="en" className={`h-full antialiased ${barlow.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
        <DialogHost />
        <RpgDialogHost />
        <TouchActive />
        <ThemeApplier />
        <FirestoreReconnect />
      </body>
    </html>
  );
}
