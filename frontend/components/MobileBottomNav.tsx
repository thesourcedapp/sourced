"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Don't show nav on onboarding pages
  if (pathname.startsWith('/onboarding')) {
    return null;
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show nav when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const navItems = [
    {
      name: "Home",
      path: "/",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      name: "Image Search",
      path: "/image_search/search",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )
    },
    {
      name: "Catalogs",
      path: "/catalogs",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    }
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600&display=swap');
      `}</style>

      {/* Only show on mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="flex justify-center px-4 pb-6">
          <div
            className={`
              bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg
              border border-black/5
              transition-all duration-300 ease-out pointer-events-auto
              ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}
            `}
            style={{
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div className="flex items-center gap-1 p-1.5">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`
                    flex flex-col items-center justify-center gap-0.5
                    px-5 py-1.5 rounded-xl
                    transition-all duration-200
                    ${isActive(item.path)
                      ? 'bg-black/5'
                      : 'hover:bg-black/5'
                    }
                  `}
                >
                  <div className={`
                    transition-colors duration-200
                    ${isActive(item.path) ? 'text-black' : 'text-black/40'}
                  `}>
                    {item.icon}
                  </div>
                  <span
                    className={`
                      text-[9px] font-semibold tracking-tight
                      transition-colors duration-200
                      ${isActive(item.path) ? 'text-black' : 'text-black/40'}
                    `}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}