"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

type SearchCatalogResult = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  item_count: number;
  bookmark_count: number;
  is_bookmarked?: boolean;
};

export default function CatalogsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchCatalogResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId !== null && !searchParams.get("q")) {
      loadPopularCatalogs();
    }
  }, [currentUserId]);

  useEffect(() => {
    const query = searchParams.get("q");
    if (query) {
      setSearchQuery(query);
      searchCatalogs(query);
    }
  }, [searchParams]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadPopularCatalogs() {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from("catalogs")
        .select(`
          id,
          name,
          description,
          image_url,
          bookmark_count,
          profiles!inner(username, full_name, avatar_url),
          catalog_items(count)
        `)
        .eq("visibility", "public")
        .order("bookmark_count", { ascending: false })
        .limit(20);

      if (error) throw error;

      let bookmarked = new Set<string>();
      if (currentUserId) {
        const { data } = await supabase
          .from("bookmarked_catalogs")
          .select("catalog_id")
          .eq("user_id", currentUserId);

        if (data) bookmarked = new Set(data.map(b => b.catalog_id));
      }

      setSearchResults(
        (data ?? []).map(catalog => ({
          id: catalog.id,
          name: catalog.name,
          description: catalog.description,
          image_url: catalog.image_url,
          username: catalog.profiles?.[0]?.username ?? "",
          full_name: catalog.profiles?.[0]?.full_name ?? null,
          avatar_url: catalog.profiles?.[0]?.avatar_url ?? null,
          item_count: catalog.catalog_items?.[0]?.count ?? 0,
          bookmark_count: catalog.bookmark_count ?? 0,
          is_bookmarked: bookmarked.has(catalog.id),
        }))
      );
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function searchCatalogs(query: string) {
    if (!query.trim()) {
      router.push("/catalogs", { scroll: false });
      loadPopularCatalogs();
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from("catalogs")
        .select(`
          id,
          name,
          description,
          image_url,
          bookmark_count,
          profiles!inner(username, full_name, avatar_url),
          catalog_items(count)
        `)
        .ilike("name", `%${query}%`)
        .eq("visibility", "public")
        .limit(20);

      if (error) throw error;

      let bookmarked = new Set<string>();
      if (currentUserId) {
        const { data: bookmarkData } = await supabase
          .from("bookmarked_catalogs")
          .select("catalog_id")
          .eq("user_id", currentUserId);

        if (bookmarkData) bookmarked = new Set(bookmarkData.map(b => b.catalog_id));
      }

      setSearchResults(
        (data ?? []).map(catalog => ({
          id: catalog.id,
          name: catalog.name,
          description: catalog.description,
          image_url: catalog.image_url,
          username: catalog.profiles?.[0]?.username ?? "",
          full_name: catalog.profiles?.[0]?.full_name ?? null,
          avatar_url: catalog.profiles?.[0]?.avatar_url ?? null,
          item_count: catalog.catalog_items?.[0]?.count ?? 0,
          bookmark_count: catalog.bookmark_count ?? 0,
          is_bookmarked: bookmarked.has(catalog.id),
        }))
      );
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = searchQuery.trim();
      router.push(q ? `/catalogs?q=${encodeURIComponent(q)}` : "/catalogs", { scroll: false });
    }
  }

  async function toggleBookmark(catalogId: string) {
    if (!currentUserId) return;

    const catalog = searchResults.find(c => c.id === catalogId);
    if (!catalog) return;

    try {
      if (catalog.is_bookmarked) {
        await supabase
          .from("bookmarked_catalogs")
          .delete()
          .eq("user_id", currentUserId)
          .eq("catalog_id", catalogId);

        setSearchResults(prev =>
          prev.map(c =>
            c.id === catalogId
              ? { ...c, is_bookmarked: false, bookmark_count: Math.max(0, c.bookmark_count - 1) }
              : c
          )
        );
      } else {
        await supabase
          .from("bookmarked_catalogs")
          .insert({
            user_id: currentUserId,
            catalog_id: catalogId
          });

        setSearchResults(prev =>
          prev.map(c =>
            c.id === catalogId
              ? { ...c, is_bookmarked: true, bookmark_count: c.bookmark_count + 1 }
              : c
          )
        );
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&display=swap');
      `}</style>

      <div className="min-h-screen bg-white text-black">
        {/* Header */}
        <div className="border-b border-black/20 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <div>
                <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-2" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
                  EXPLORE CATALOGS
                </h1>
                <p className="text-sm tracking-wider opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {searchParams.get("q") ? `SEARCH RESULTS FOR "${searchParams.get("q")}"` : "DISCOVER POPULAR CATALOGS"}
                </p>
              </div>

              {/* Search Input */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="SEARCH CATALOGS..."
                className="w-full px-6 py-4 border-2 border-black focus:outline-none focus:border-black/50 text-sm tracking-wider bg-white placeholder-black/40"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              />
            </div>
          </div>
        </div>

        {/* Navigation - VERY VISIBLE */}
        <div className="border-b-4 border-black/20">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex overflow-x-auto gap-2">
              <button
                className="py-4 px-8 text-base md:text-lg tracking-wider font-black bg-black text-white whitespace-nowrap"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                EXPLORE
              </button>
              {currentUserId && (
                <button
                  onClick={() => router.push('/catalogs/your_catalogs')}
                  className="py-4 px-8 text-base md:text-lg tracking-wider font-black border-2 border-black text-black hover:bg-black hover:text-white transition-all whitespace-nowrap"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  YOUR CATALOGS →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            {searchLoading ? (
              <div className="text-center py-20">
                <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  LOADING...
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  NO CATALOGS FOUND
                </p>
                <p className="text-sm tracking-wide opacity-30 mt-2">
                  {searchParams.get("q") ? "Try a different search term" : "No public catalogs available yet"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map((catalog) => (
                  <div
                    key={catalog.id}
                    className="group border border-black/20 hover:border-black transition-all"
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => router.push(`/catalogs/${catalog.id}`)}
                    >
                      <div className="aspect-square bg-white overflow-hidden">
                        {catalog.image_url ? (
                          <img
                            src={catalog.image_url}
                            alt={catalog.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full bg-black/5 flex items-center justify-center">
                            <span className="text-6xl opacity-20">✦</span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 border-t border-black/20">
                        <h3 className="text-lg font-black tracking-wide uppercase truncate mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          {catalog.name}
                        </h3>

                        {catalog.description && (
                          <p className="text-xs opacity-60 mb-3 leading-relaxed line-clamp-2">
                            {catalog.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full border border-black/20 overflow-hidden flex-shrink-0">
                            {catalog.avatar_url ? (
                              <img
                                src={catalog.avatar_url}
                                alt={catalog.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                <span className="text-xs opacity-20">👤</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs tracking-wider opacity-60" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            BY @{catalog.username}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-xs tracking-wider opacity-60">
                          <span>🔖 {catalog.bookmark_count} BOOKMARKS</span>
                          <span>{catalog.item_count} ITEMS</span>
                        </div>
                      </div>
                    </div>

                    {/* Bookmark button */}
                    {currentUserId && (
                      <div className="p-3 border-t border-black/10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(catalog.id);
                          }}
                          className={`w-full py-2 border transition-all text-xs tracking-[0.4em] font-black ${
                            catalog.is_bookmarked
                              ? 'border-black bg-black text-white hover:bg-white hover:text-black'
                              : 'border-black hover:bg-black hover:text-white'
                          }`}
                          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                        >
                          {catalog.is_bookmarked ? '🔖 BOOKMARKED' : '🔖 BOOKMARK'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}