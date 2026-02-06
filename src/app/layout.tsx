import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Navbar from "@/components/Navbar";

// Display font - elegant modern serif for headlines
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Body font - clean modern sans-serif
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Mono font - for data, numbers, code
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0c0d10",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "ITS Business Core",
  description: "Precision business management for modern organizations",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-body antialiased">
        <SessionProvider>
          {/* Ambient background effects */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div
              className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full opacity-[0.03]"
              style={{
                background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
                filter: 'blur(100px)'
              }}
            />
            <div
              className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full opacity-[0.02]"
              style={{
                background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 70%)',
                filter: 'blur(120px)'
              }}
            />
          </div>

          <Navbar />
          <main className="relative pb-20 lg:pb-0">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
