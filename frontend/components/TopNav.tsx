"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type TopNavProps = {
  mobile?: boolean;
};

export default function TopNav({ mobile = false }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (mobile) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        `}</style>

        {/* Mobile - Just search bar */}
        <form onSubmit={handleSearch} className="flex-1">
          <input
            type="text"
            placeholder="SEARCH..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-black/30 bg-white text-black placeholder-black/40 focus:outline-none focus:border-black text-sm tracking-wide"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          />
        </form>
      </>
    );
  }

  // Desktop version
  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
      `}</style>

      <div className="flex items-center gap-4 flex-1 max-w-4xl">
        <form onSubmit={handleSearch} className="flex-[2]">
          <input
            type="text"
            placeholder="SEARCH FASHION..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 border-2 border-black bg-white text-black placeholder-black/50 focus:outline-none focus:border-black text-sm tracking-wider"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          />
        </form>

        <div className="flex items-center gap-1 flex-shrink-0">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex items-center gap-2 px-3 py-1.5 transition-all text-sm tracking-wide font-black ${
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
      </div>
    </>
  );
}