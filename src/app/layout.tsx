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
  title: "StartFriday Coffee - Self Service",
  description: "Self-service ordering system for StartFriday Coffee Shop",
  icons: {
    icon: '/rakken-icon.svg',
    shortcut: '/rakken-icon.svg',
    apple: '/rakken-icon.svg',
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
        <link rel="preload" href="/api/menu" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="https://api-dash.olsera.co.id/img/no_data_item.png" as="image" fetchPriority="high" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';
                link.media = 'print';
                link.onload = function() { this.media = 'all'; };
                document.head.appendChild(link);
              })();
            `
          }}
        />
        <noscript>
          <link
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
            rel="stylesheet"
          />
        </noscript>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#A8131E" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rakken POS" />
      </head>
      <body className={`${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} font-sans`}>
        <SentryProvider>
          <OfflineSyncProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </OfflineSyncProvider>
        </SentryProvider>
      </body>
    </html>
  );
}
