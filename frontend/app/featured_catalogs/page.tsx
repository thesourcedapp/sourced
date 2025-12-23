"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";

type FeaturedCatalog = {
  id: string;
  name: string;
  image_url: string;
  visibility: string;
  owner_id: string;
  username: string;
  full_name: string;
  created_at: string;
};

export default function FeaturedCatalogsPage() {
  const router = useRouter();
  const [catalogs, setCatalogs] = useState<FeaturedCatalog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeaturedCatalogs();
  }, []);

  async function loadFeaturedCatalogs() {
    const { data, error } = await supabase
      .from("featured_catalogs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading featured catalogs:", error);
    } else {
      setCatalogs(data || []);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        `}</style>
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
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
      `}</style>

      <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="border-b border-white/20 p-6 md:p-10">
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
          <div className="max-w-7xl mx-auto">

            {catalogs.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm tracking-wider opacity-40">
                  No featured catalogs yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {catalogs.map((catalog) => (
                  <button
                    key={catalog.id}
                    onClick={() => router.push(`/catalogs/${catalog.id}`)}
                    className="group relative aspect-[3/4] border-2 border-white overflow-hidden hover:border-white/50 transition-all"
                  >
                    {/* Image */}
                    {catalog.image_url ? (
                      <div className="absolute inset-0">
                        <Image
                          src={catalog.image_url}
                          alt={catalog.name}
                          fill
                          className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                        <span className="text-6xl opacity-20">✦</span>
                      </div>
                    )}

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-300" />

                    {/* Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
                      <div className="space-y-1">
                        <h3 className="text-lg font-black tracking-wide uppercase" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          {catalog.name}
                        </h3>
                        <p className="text-[10px] tracking-[0.3em] opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          BY @{catalog.username}
                        </p>
                      </div>
                    </div>

                    {/* Featured badge */}
                    <div className="absolute top-4 right-4 px-3 py-1 bg-white text-black text-[8px] tracking-[0.4em] font-black" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                      FEATURED
                    </div>

                    {/* Glitch border effect */}
                    <div className="absolute -top-1 -left-1 w-full h-full border border-white opacity-0 group-hover:opacity-30 pointer-events-none transition-opacity" />
                  </button>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-white/20 p-6 md:p-10 mt-20">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-[9px] tracking-[0.5em] opacity-30" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              HANDPICKED COLLECTIONS
            </p>
          </div>
        </div>
      </div>
    </>
  );
}