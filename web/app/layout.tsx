import type { Metadata, Viewport } from "next";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@/modules/globals.css";

export const metadata: Metadata = {
  title: "What The Bill",
  description: "Your city. Your government. In plain English.",
};

export const viewport: Viewport = {
  themeColor: "#0b1117",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}