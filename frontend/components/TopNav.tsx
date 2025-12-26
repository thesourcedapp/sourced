"use client";

import { usePathname, useRouter } from "next/navigation";

type TopNavProps = {
  mobile?: boolean;
};

export default function TopNav({ mobile = false }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    {
      name: "HOME",
      path: "/",
      icon: "⌂"
    },
    {
      name: "DISCOVER",
      path: "/discover",
      icon: "◉"
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

  if (mobile) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        `}</style>

        {/* Mobile - Nothing (just SOURCED logo and profile handled by parent) */}
        <div className="flex-1"></div>
      </>
    );
  }

  // Desktop version - just buttons
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
      `}</style>

      <div className="flex items-center gap-2 flex-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`flex items-center gap-2 px-6 py-2 transition-all text-sm tracking-wider font-black ${
              isActive(item.path)
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-black/10 border border-black/20"
            }`}
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}