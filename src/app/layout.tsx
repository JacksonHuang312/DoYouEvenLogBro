import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { DialogHost } from "@/components/DialogHost";
import { TouchActive } from "@/components/TouchActive";
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
  title: "Do You Even Log Bro",
  description: "Free workout tracker: log sets, reps and weight.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  // Lets the layout extend under the iPhone home bar; safe-area padding keeps controls clear of it.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
        <DialogHost />
        <TouchActive />
      </body>
    </html>
  );
}
