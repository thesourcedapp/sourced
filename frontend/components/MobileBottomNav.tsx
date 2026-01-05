"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);

  // Don't show nav on onboarding pages
  if (pathname.startsWith('/onboarding')) {
    return null;
  }

  // No scroll behavior - only manual toggle

  const navItems = [
    {
      name: "Home",
      path: "/",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      name: "Discover",
      path: "/discover",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      name: "Feed",
      path: "/feed",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      )
    },
    {
      name: "Image Search",
      path: "/image_search",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )
    },
    {
      name: "Create",
      path: "/create",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none mobile-bottom-nav">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600&display=swap');
      `}</style>

      <div className="flex justify-center px-4 pb-6">

        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className="transition-all duration-300 ease-out pointer-events-auto hover:scale-110 animate-bounce"
          >
            <svg className="w-6 h-6 text-white/60 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        ) : (
          <div
            className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-black/5 transition-all duration-300 ease-out pointer-events-auto"
            style={{
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div className="flex justify-center pt-1 pb-0.5">
              <button
                onClick={() => setIsExpanded(false)}
                className="p-0.5 hover:bg-black/5 rounded-full transition-colors"
              >
                <svg className="w-3 h-3 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-0.5 p-1.5 pt-0">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                    isActive(item.path) ? 'bg-black/5' : 'hover:bg-black/5'
                  }`}
                >
                  <div className={`transition-colors duration-200 ${
                    isActive(item.path) ? 'text-black' : 'text-black/40'
                  }`}>
                    {item.icon}
                  </div>
                  <span
                    className={`text-[8px] font-semibold tracking-tight transition-colors duration-200 ${
                      isActive(item.path) ? 'text-black' : 'text-black/40'
                    }`}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}