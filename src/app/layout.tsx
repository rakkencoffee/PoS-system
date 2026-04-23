import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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

import QueryProvider from "@/providers/QueryProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} font-sans`}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
