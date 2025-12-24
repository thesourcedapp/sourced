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
  title: "Sourced",
  description: "Discover and organize fashion catalogs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-white">
        <header className="bg-white border-b border-black/10">
          {/* Desktop Header */}
          <div className="hidden md:flex justify-between items-center px-5 py-3 gap-5">
            <div style={{
              fontFamily: "Arial Black, sans-serif",
              fontSize: "22px",
              fontWeight: "900",
              letterSpacing: "-0.5px",
              color: "black",
              flexShrink: 0
            }}>
              SOURCED
            </div>
            <TopNav />
            <AuthWidget showUsername={true} />
          </div>

          {/* Mobile Header - Two rows for better spacing */}
          <div className="md:hidden">
            {/* Top row - Logo and Profile */}
            <div className="flex items-center justify-between px-4 py-3">
              <div style={{
                fontFamily: "Arial Black, sans-serif",
                fontSize: "18px",
                fontWeight: "900",
                letterSpacing: "-0.5px",
                color: "black",
                flexShrink: 0
              }}>
                SOURCED
              </div>
              <AuthWidget showUsername={false} />
            </div>

            {/* Bottom row - Search Bar (full width) */}
            <div className="px-4 pb-3">
              <TopNav mobile={true} />
            </div>
          </div>
        </header>

        <main className="flex-1 pb-6 md:pb-0">{children}</main>

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