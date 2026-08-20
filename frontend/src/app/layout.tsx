import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: "PlanCraft AI — Planos de instalaciones con IA",
  description:
    "Generá planos de instalaciones eléctricas, sanitarias y de gas a partir de una descripción, editalos planta por planta y exportalos a PDF.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html lang="es" className={`${inter.variable} ${outfit.variable}`}>
        <body className="min-h-dvh bg-paper-100 font-sans text-ink-800 antialiased">
          <SiteHeader />
          {children}
          <SiteFooter />
        </body>
      </html>
    </ClerkProvider>
  );
}
