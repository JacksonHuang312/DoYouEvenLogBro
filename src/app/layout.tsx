import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { DialogHost } from "@/components/DialogHost";
import { FirestoreReconnect } from "@/components/FirestoreReconnect";
import { TouchActive } from "@/components/TouchActive";
import "./globals.css";

export const metadata: Metadata = {
  title: "Do You Even Log Bro",
  description: "Free workout tracker: log sets, reps and weight.",
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
        <DialogHost />
        <TouchActive />
        <FirestoreReconnect />
      </body>
    </html>
  );
}
