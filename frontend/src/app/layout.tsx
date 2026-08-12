import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlanCraft AI",
  description:
    "Generá planos de instalaciones eléctricas y sanitarias a partir de una descripción.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body className="min-h-dvh bg-white text-neutral-900 antialiased">
          <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
            <span className="text-sm font-semibold">PlanCraft AI</span>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
                  Iniciar sesión
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
