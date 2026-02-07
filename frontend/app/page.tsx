"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type FeaturedCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  visibility: string;
  owner_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  slug: string;
  created_at: string;
};

type CatalogItem = {
  id: string;
  title: string;
  image_url: string;
  product_url: string | null;
  price: string | null;
  seller: string | null;
  click_count?: number;
};

export default function FeaturedCatalogsPage() {
  const router = useRouter();
  const [catalogs, setCatalogs] = useState<FeaturedCatalog[]>([]);
  const [catalogItems, setCatalogItems] = useState<Record<string, CatalogItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeaturedCatalogs();
  }, []);

  async function loadFeaturedCatalogs() {
    try {
      const { data, error } = await supabase
        .from("featured_catalogs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading featured catalogs:", error);
        return;
      }

      setCatalogs(data || []);

      // Load items for each catalog
      if (data) {
        for (const catalog of data) {
          loadCatalogItems(catalog.id);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalogItems(catalogId: string) {
    const { data, error } = await supabase
      .from("catalog_items")
      .select("id, title, image_url, product_url, price, seller, click_count")
      .eq("catalog_id", catalogId)
      .limit(20);

    if (!error && data) {
      setCatalogItems(prev => ({
        ...prev,
        [catalogId]: data
      }));
    }
  }

  // Track click function
  async function trackClick(itemId: string, itemType: 'catalog' | 'feed') {
    try {
      await fetch('/api/track-click', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId, itemType }),
      });
    } catch (error) {
      console.error('Error tracking click:', error);
      // Don't block the navigation if tracking fails
    }
  }

  // Handle item click
  async function handleItemClick(item: CatalogItem, e: React.MouseEvent) {
    e.stopPropagation();

    if (item.product_url) {
      // Track the click (fire and forget)
      trackClick(item.id, 'catalog');

      // Open the link
      window.open(item.product_url, '_blank');
    }
  }

  if (loading) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        `}</style>
        <div className="min-h-screen bg-white text-black flex items-center justify-center">
          <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            LOADING...
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');

        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-scroll {
          animation: scroll 30s linear infinite;
        }

        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="min-h-screen bg-white text-black">
        {/* Header */}
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-2">
              <div className="text-[10px] tracking-[0.5em] opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                CURATED SELECTION
              </div>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                FEATURED
              </h1>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10">
          <div className="max-w-6xl mx-auto">

            {catalogs.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm tracking-wider opacity-40">
                  No featured catalogs yet
                </p>
              </div>
            ) : (
              <div className="space-y-8 md:space-y-12">
                {catalogs.map((catalog) => (
                  <div key={catalog.id} className="space-y-4">
                    <div
                      className="group w-full hover:bg-black/5 p-6 transition-all duration-300 border border-black/20 hover:border-black/50 cursor-pointer"
                      onClick={() => router.push(`/${catalog.username}/${catalog.slug}`)}
                    >
                      {/* Mobile layout - stacked */}
                      <div className="flex md:hidden flex-col gap-6">
                        <div className="flex flex-col gap-4 items-start">
                          <div className="flex-1 space-y-4 w-full">
                            {/* Profile icon + Username */}
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity w-fit"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/${catalog.username}`);
                              }}
                            >
                              <div className="w-6 h-6 rounded-full border border-black overflow-hidden flex-shrink-0">
                                {catalog.avatar_url ? (
                                  <img src={catalog.avatar_url} alt={catalog.username} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                    <span className="text-[8px] opacity-20">👤</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs tracking-[0.3em] opacity-60 group-hover:opacity-100 transition-opacity" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                @{catalog.username}
                              </p>
                            </div>

                            {/* Catalog name */}
                            <h3 className="text-3xl font-black tracking-wide uppercase leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                              {catalog.name}
                            </h3>

                            {/* Description */}
                            {catalog.description && (
                              <p className="text-sm tracking-wide opacity-80 leading-relaxed">
                                {catalog.description}
                              </p>
                            )}

                            {/* Stats and badges */}
                            <div className="flex items-center gap-4 pt-2">
                              <span className="inline-block px-3 py-1 bg-black text-white text-[8px] tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                ★ FEATURED
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Image - mobile */}
                        <div className="w-full h-64 border-2 border-black overflow-hidden relative">
                          {catalog.image_url ? (
                            <img
                              src={catalog.image_url}
                              alt={catalog.name}
                              className="w-full h-full object-cover transition-all duration-500"
                              onError={(e) => {
                                console.log("Image failed to load:", catalog.image_url);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-black/5 flex items-center justify-center">
                              <span className="text-6xl opacity-20">✦</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Desktop layout - side by side */}
                      <div className="hidden md:flex flex-row gap-6 items-start">
                        {/* Left side - Text info */}
                        <div className="flex-1 space-y-4">
                          {/* Profile icon + Username */}
                          <div
                            className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity w-fit"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/${catalog.username}`);
                            }}
                          >
                            <div className="w-8 h-8 rounded-full border border-black overflow-hidden flex-shrink-0">
                              {catalog.avatar_url ? (
                                <img src={catalog.avatar_url} alt={catalog.username} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                  <span className="text-xs opacity-20">👤</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs tracking-[0.3em] opacity-60 group-hover:opacity-100 transition-opacity" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              @{catalog.username}
                            </p>
                          </div>

                          {/* Catalog name */}
                          <h3 className="text-3xl md:text-4xl font-black tracking-wide uppercase leading-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                            {catalog.name}
                          </h3>

                          {/* Description */}
                          {catalog.description && (
                            <p className="text-sm tracking-wide opacity-80 leading-relaxed max-w-xl">
                              {catalog.description}
                            </p>
                          )}

                          {/* Stats and badges */}
                          <div className="flex items-center gap-4 pt-2">
                            <span className="inline-block px-3 py-1 bg-black text-white text-[8px] tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                              ★ FEATURED
                            </span>
                          </div>
                        </div>

                        {/* Right side - Square Image */}
                        <div className="w-full md:w-64 h-64 flex-shrink-0 border-2 border-black overflow-hidden relative">
                          {catalog.image_url ? (
                            <img
                              src={catalog.image_url}
                              alt={catalog.name}
                              className="w-full h-full object-cover transition-all duration-500"
                              onError={(e) => {
                                console.log("Image failed to load:", catalog.image_url);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-black/5 flex items-center justify-center">
                              <span className="text-6xl opacity-20">✦</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Conveyor Belt of Items */}
                    {catalogItems[catalog.id] && catalogItems[catalog.id].length > 0 && (
                      <div className="overflow-hidden border-t border-b border-black/10 py-6 bg-white">
                        <div className="flex animate-scroll" style={{ width: 'max-content' }}>
                          {/* Duplicate items twice to create seamless loop */}
                          {[...catalogItems[catalog.id], ...catalogItems[catalog.id], ...catalogItems[catalog.id]].map((item, idx) => (
                            <div
                              key={`${item.id}-${idx}`}
                              className="flex-shrink-0 w-40 mx-4 group cursor-pointer"
                              onClick={(e) => handleItemClick(item, e)}
                            >
                              {/* Item image */}
                              <div className="w-40 h-40 border border-black/30 bg-white overflow-hidden group-hover:border-black transition-all mb-2">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                    <span className="text-2xl opacity-20">✦</span>
                                  </div>
                                )}
                              </div>

                              {/* Item info */}
                              <div className="space-y-1">
                                <p className="text-xs font-black tracking-wide uppercase truncate" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                  {item.title}
                                </p>
                                {(item.seller || item.price) && (
                                  <div className="flex items-center justify-between text-[9px] tracking-wider opacity-50">
                                    {item.seller && <span className="truncate">{item.seller}</span>}
                                    {item.price && <span className="ml-auto">{item.price}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-black/20 p-6 md:p-10 mt-20">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-[9px] tracking-[0.5em] opacity-30" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              TOP COLLECTIONS
            </p>
          </div>
        </div>
      </div>
    </>
  );
}