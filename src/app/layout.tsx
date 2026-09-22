import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rakken Coffee - Self Service",
  description: "Self-service ordering system for Rakken Coffee Shop",
  icons: {
    icon: '/rakken-icon.svg',
    shortcut: '/rakken-icon.svg',
    apple: '/apple-touch-icon.png',
  },
};

// Kiosk devices (tablets) shouldn't let customers pinch-zoom or accidentally
// scale the layout mid-order.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import QueryProvider from "@/providers/QueryProvider";
import AuthSessionProvider from "@/providers/AuthSessionProvider";
import SentryProvider from "@/components/SentryProvider";
import OfflineSyncProvider from "@/components/OfflineSyncProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Loaded synchronously (not the async media="print" swap trick) --
            on a kiosk that stays running and gets this font cached after its
            first load, a few extra ms blocking first paint is worth it to
            guarantee icons never flash as their raw text names
            ("arrow_forward", "search", etc.) before the font arrives, which
            the async version visibly did on a cold cache (confirmed live
            2026-09-22). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#A8131E" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rakken POS" />
      </head>
      <body className={`${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} font-sans`}>
        <SentryProvider>
          <AuthSessionProvider>
            <OfflineSyncProvider>
              <QueryProvider>
                {children}
              </QueryProvider>
            </OfflineSyncProvider>
          </AuthSessionProvider>
        </SentryProvider>
      </body>
    </html>
  );
}
