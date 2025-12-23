"use client";

import { usePathname, useRouter } from "next/navigation";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    {
      name: "HOME",
      path: "/",
      icon: "⌂"
    },
    {
      name: "IMAGE SEARCH",
      path: "/image_search/search",
      icon: "⊕"
    },
    {
      name: "CATALOGS",
      path: "/catalogs",
      icon: "▦"
    }
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
      `}</style>

      {/* Only show on mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-black/20">
        <div className="flex">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 transition-all text-xs tracking-wide font-black ${
                isActive(item.path)
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-black/5"
              }`}
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px]">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}