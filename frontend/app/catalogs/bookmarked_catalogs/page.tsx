"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type BookmarkedCatalog = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  item_count: number;
  bookmark_count: number;
  created_at: string;
};

export default function BookmarkedCatalogsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [bookmarkedCatalogs, setBookmarkedCatalogs] = useState<BookmarkedCatalog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadBookmarkedCatalogs();
    }
  }, [currentUserId]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  }

  async function loadBookmarkedCatalogs() {
  if (!currentUserId) return;

  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('bookmarked_catalogs')
      .select(`
        catalogs!inner(
          id,
          name,
          description,
          image_url,
          bookmark_count,
          profiles!inner(username, full_name, avatar_url),
          catalog_items(count)
        ),
        created_at
      `)
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const transformedCatalogs: BookmarkedCatalog[] = data.map(bookmark => {
        const catalog = Array.isArray(bookmark.catalogs) ? bookmark.catalogs[0] : bookmark.catalogs;
        const owner = Array.isArray(catalog?.profiles) ? catalog.profiles[0] : catalog?.profiles;

        return {
          id: catalog?.id,
          name: catalog?.name,
          description: catalog?.description,
          image_url: catalog?.image_url,
          bookmark_count: catalog?.bookmark_count,
          item_count: catalog?.catalog_items?.[0]?.count || 0,
          username: owner?.username || 'Unknown',
          full_name: owner?.full_name || null,
          avatar_url: owner?.avatar_url || null,
          created_at: bookmark.created_at
        };
      });

      setBookmarkedCatalogs(transformedCatalogs);
    }
  } catch (error) {
    console.error('Error loading bookmarked catalogs:', error);
  } finally {
    setLoading(false);
  }
}

  async function unbookmarkCatalog(catalogId: string) {
    if (!currentUserId) return;

    try {
      await supabase
        .from('bookmarked_catalogs')
        .delete()
        .eq('user_id', currentUserId)
        .eq('catalog_id', catalogId);

      // Remove from local state
      setBookmarkedCatalogs(prevCatalogs =>
        prevCatalogs.filter(catalog => catalog.id !== catalogId)
      );
    } catch (error) {
      console.error('Error unbookmarking catalog:', error);
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
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
              BOOKMARKED
            </h1>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-black/20">
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => router.push('/catalogs')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                SEARCH CATALOGS
              </button>
              <button
                onClick={() => router.push('/catalogs/your_catalogs')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                YOUR CATALOGS
              </button>
              <button
                onClick={() => router.push('/catalogs/liked_items')}
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-transparent text-black/40 hover:text-black/70 transition-all"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                LIKED ITEMS
              </button>
              <button
                className="py-4 px-6 text-sm tracking-wider font-black border-b-2 border-black text-black"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                BOOKMARKED
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-6">
              <p className="text-sm tracking-wider opacity-60">
                Catalogs you've bookmarked for later
              </p>

              {loading ? (
                <div className="text-center py-20">
                  <p className="text-xs tracking-[0.4em]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    LOADING...
                  </p>
                </div>
              ) : bookmarkedCatalogs.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-lg tracking-wider opacity-40" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                    NO BOOKMARKS YET
                  </p>
                  <p className="text-sm tracking-wide opacity-30 mt-2">
                    Bookmark catalogs to save them here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bookmarkedCatalogs.map((catalog) => (
                    <div key={catalog.id} className="group border border-black/20 hover:border-black hover:scale-105 transform transition-all duration-200 relative">
                      <div
                        className="cursor-pointer"
                        onClick={() => router.push(`/catalogs/${catalog.id}`)}
                      >
                        <div className="aspect-square bg-white overflow-hidden">
                          {catalog.image_url ? (
                            <img
                              src={catalog.image_url}
                              alt={catalog.name}
                              className="w-full h-full object-cover"
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
                          <p className="text-xs tracking-wider opacity-40 mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                            BY @{catalog.username}
                          </p>
                          <div className="flex items-center justify-between text-xs tracking-wider opacity-60">
                            <span>🔖 {catalog.bookmark_count} bookmarks</span>
                            <span>{catalog.item_count} items</span>
                          </div>
                        </div>
                      </div>

                      {/* Remove bookmark button - now always visible on mobile, hover on desktop */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unbookmarkCatalog(catalog.id);
                        }}
                        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-500/80 hover:bg-red-500 border border-red-600 text-white transition-all md:opacity-0 md:group-hover:opacity-100"
                        aria-label="Remove bookmark"
                      >
                        <span className="text-xs">✕</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}