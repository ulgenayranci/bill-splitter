import type { Metadata, Viewport } from "next";
import { Archivo, Caveat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-sans',
});

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-accent',
});

export const metadata: Metadata = {
  title: "easy billsy",
  description: "Split the restaurant bill without killing the vibe.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", archivo.variable, caveat.variable)}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
