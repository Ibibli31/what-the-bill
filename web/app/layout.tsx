import type { Metadata, Viewport } from "next";
import "@fontsource/bai-jamjuree/400.css";
import "@fontsource/bai-jamjuree/500.css";
import "@fontsource/bai-jamjuree/600.css";
import "@fontsource/bai-jamjuree/700.css";
import "@/modules/globals.css";

export const metadata: Metadata = {
  title: "What The Bill",
  description: "Your city. Your government. In plain English.",
};

export const viewport: Viewport = {
  themeColor: "#232323",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
