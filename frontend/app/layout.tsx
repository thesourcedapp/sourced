import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthWidget from "../components/AuthWidget";
import SignupModal from "../components/SignupModal";
import TopNav from "../components/TopNav";
import MobileBottomNav from "../components/MobileBottomNav";
import Link from "next/link";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sourced - Visual Fashion Discovery",
  description: "Create and organize fashion catalogs of clothing you love. Upload images to find similar pieces, build curated collections, and share your style with others. Discover new fashion through visual search and community catalogs.",

  // Open Graph (Facebook, iMessage, LinkedIn, WhatsApp, etc.)
  openGraph: {
    title: "Sourced - Visual Fashion Discovery",
    description: "Create and organize fashion catalogs of clothing you love. Upload images to find similar pieces, build curated collections, and share your style with others.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sourced - Fashion Discovery Platform",
      }
    ],
    type: "website",
    siteName: "Sourced",
  },

  // Twitter/X
  twitter: {
    card: "summary_large_image",
    title: "Sourced - Visual Fashion Discovery",
    description: "Create and organize fashion catalogs of clothing you love. Upload images to find similar pieces, build curated collections, and share your style.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Favicon - browser tab icon */}
        <link rel="icon" href="/logo-s.svg" type="image/svg+xml" />

        {/* Apple Touch Icon - for iOS sharing/home screen */}
        <link rel="apple-touch-icon" href="/logo-s2.png" />

        <style>{`
          /* Prevent zoom on mobile inputs - CRITICAL for iOS */
          input, textarea, select {
            font-size: 16px !important;
          }
        `}</style>
      </head>
      <body className="flex flex-col min-h-screen bg-white">
        <header className="bg-white border-b border-black/10">
          {/* Desktop Header */}
          <div className="hidden md:flex justify-between items-center px-5 py-3 gap-5">
            <Link href="/" style={{
              fontFamily: "Arial Black, sans-serif",
              fontSize: "22px",
              fontWeight: "900",
              letterSpacing: "-0.5px",
              color: "black",
              flexShrink: 0,
              textDecoration: "none"
            }}>
              SOURCED
            </Link>
            <TopNav />
            <AuthWidget showUsername={true} />
          </div>

          {/* Mobile Header - Compact single row */}
          <div className="md:hidden flex items-center justify-between px-4 py-2">
            <Link href="/" style={{
              fontFamily: "Arial Black, sans-serif",
              fontSize: "18px",
              fontWeight: "900",
              letterSpacing: "-0.5px",
              color: "black",
              flexShrink: 0,
              textDecoration: "none"
            }}>
              SOURCED
            </Link>
            <TopNav mobile={true} />
            <AuthWidget showUsername={false} />
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {/* Footer - Always at bottom */}
        <footer className="bg-white border-t border-black/10 py-8 px-4 md:px-10">
          <div className="max-w-7xl mx-auto">
            {/* Footer Links */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
              <Link
                href="/legal/privacy"
                className="text-black/60 hover:text-black transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/legal/terms"
                className="text-black/60 hover:text-black transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/legal/dmca"
                className="text-black/60 hover:text-black transition-colors"
              >
                Copyright & DMCA
              </Link>
              <Link
                href="/legal/contact"
                className="text-black/60 hover:text-black transition-colors"
              >
                Contact
              </Link>
              <Link
                href="/legal/requests"
                className="text-black/60 hover:text-black transition-colors"
              >
                Data Requests
              </Link>
              <Link
                href="/legal/about"
                className="text-black/60 hover:text-black transition-colors"
              >
                About
              </Link>
            </div>

            {/* Copyright */}
            <div className="text-center mt-6 text-xs text-black/40">
              © {new Date().getFullYear()} Sourced. All rights reserved.
            </div>
          </div>
        </footer>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </body>
    </html>
  );
}