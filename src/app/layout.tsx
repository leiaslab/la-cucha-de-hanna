import type { Metadata, Viewport } from "next";
import { AuthGate } from "../components/AuthGate";
import { AppBootstrap } from "../components/AppBootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "La cucha de Hanna",
  description: "Gestion de stock, catalogo y ventas offline para La cucha de Hanna.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthGate>
          <AppBootstrap>{children}</AppBootstrap>
        </AuthGate>
      </body>
    </html>
  );
}
