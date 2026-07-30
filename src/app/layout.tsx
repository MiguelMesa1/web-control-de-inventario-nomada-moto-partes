import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const pattanakarn = localFont({
  src: [
    {
      path: "../assets/fonts/Pattanakarn-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/Pattanakarn-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-pattanakarn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nómada Moto Partes | Inventario",
  description:
    "Inventario, trazabilidad y variación de existencias para Nómada Moto Partes.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${pattanakarn.variable} font-sans`}>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
