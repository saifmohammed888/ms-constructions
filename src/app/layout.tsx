import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "MS Constructions — Site tracker",
  description: "Track people, money, tasks, and documents for a Bangalore residential build.",
};

// resizes-content makes browsers shrink the layout viewport when the on-screen
// keyboard opens, so `100dvh` screens (e.g. the agent chat) stay flush above it
// instead of being covered.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
