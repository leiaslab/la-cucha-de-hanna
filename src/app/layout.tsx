import type { Metadata, Viewport } from "next";
import { AuthGate } from "../components/AuthGate";
import { AppBootstrap } from "../components/AppBootstrap";
import { ErrorBoundary } from "../components/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "VENTAS",
  description: "Sistema de ventas, stock y caja para multiples locales.",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/icon-192x192.png?v=2",
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
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark'}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ErrorBoundary>
          <AuthGate>
            <AppBootstrap>{children}</AppBootstrap>
          </AuthGate>
        </ErrorBoundary>
      </body>
    </html>
  );
}
