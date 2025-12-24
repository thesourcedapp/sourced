"use client";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style jsx global>{`
        /* Hide parent header and navigation */
        header { display: none !important; }
        nav { display: none !important; }
      `}</style>

      {/* Main content - no header/nav */}
      <div className="min-h-screen bg-black pb-20">
        {children}
      </div>

      {/* Footer with legal links only */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 p-4 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-6 text-[9px] tracking-[0.3em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            <a
              href="/legal/privacy"
              target="_blank"
              className="hover:opacity-100 transition-opacity"
            >
              PRIVACY
            </a>
            <span>•</span>
            <a
              href="/legal/terms"
              target="_blank"
              className="hover:opacity-100 transition-opacity"
            >
              TERMS
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}